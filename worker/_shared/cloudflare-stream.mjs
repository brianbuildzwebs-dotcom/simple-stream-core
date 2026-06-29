const DEFAULT_CLOUDFLARE_RTMPS_INGEST = 'rtmps://live.cloudflare.com:443/live/';

/** Cloudflare's API may return https:// for the RTMPS ingest endpoint — normalize for OBS/vMix. */
export function normalizeCloudflareRtmpsIngestUrl(url) {
  const raw = (url || '').trim();
  if (!raw) return DEFAULT_CLOUDFLARE_RTMPS_INGEST;

  let normalized = raw;
  if (/^https?:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^https?:\/\//i, 'rtmps://');
  } else if (!/^rtmps?:\/\//i.test(normalized)) {
    return DEFAULT_CLOUDFLARE_RTMPS_INGEST;
  }

  if (/^rtmp:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^rtmp:\/\//i, 'rtmps://');
  }

  return `${normalized.replace(/\/+$/, '')}/`;
}

export function buildHlsPlaybackUrl(customerCode, inputId) {
  if (!customerCode || !inputId) return null;
  return `https://customer-${customerCode}.cloudflarestream.com/${inputId}/manifest/video.m3u8`;
}

export function buildRecordingHlsPlaybackUrl(customerCode, videoUid) {
  if (!customerCode || !videoUid) return null;
  return `https://customer-${customerCode}.cloudflarestream.com/${videoUid}/manifest/video.m3u8`;
}

function recordingTimestamp(video) {
  return Date.parse(video?.created || video?.uploaded || 0) || 0;
}

export function listReadyRecordings(videos) {
  if (!Array.isArray(videos)) return [];

  return videos
    .filter((video) => video?.status?.state === 'ready' && video?.uid)
    .sort((a, b) => recordingTimestamp(b) - recordingTimestamp(a));
}

export function pickLatestReadyRecording(videos) {
  return listReadyRecordings(videos)[0] ?? null;
}

export function recordingDurationSeconds(video) {
  const raw = Number(video?.duration ?? video?.meta?.duration ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw);
}

async function cloudflareStreamFetch(env, path, init = {}) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) return null;

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) return null;
  return payload.result;
}

function isLiveInProgressVideo(video) {
  return String(video?.status?.state || '').toLowerCase() === 'live-inprogress';
}

/** Uses Cloudflare's public lifecycle endpoint, then falls back to live-inprogress videos. */
export async function fetchCloudflareLiveInputStatus(env, inputId) {
  if (!inputId) return { connected: false };

  const customerCode = env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (customerCode) {
    try {
      const response = await fetch(
        `https://customer-${customerCode}.cloudflarestream.com/${inputId}/lifecycle`
      );
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.live === true) {
          return { connected: true, videoUid: payload.videoUID || null };
        }
        if (payload?.live === false) {
          return { connected: false, videoUid: null };
        }
      }
    } catch {
      // Fall through to API-based detection.
    }
  }

  const videos = await cloudflareStreamFetch(env, `live_inputs/${inputId}/videos`);
  if (Array.isArray(videos)) {
    const active = videos.find(isLiveInProgressVideo);
    if (active) {
      return { connected: true, videoUid: active.uid || null };
    }
  }

  return { connected: false, videoUid: null };
}

export async function fetchLiveInputRecordings(env, inputId) {
  if (!inputId) return [];

  const videos = await cloudflareStreamFetch(env, `live_inputs/${inputId}/videos`);
  const customerCode = env.CLOUDFLARE_STREAM_CUSTOMER_CODE;

  return listReadyRecordings(videos).map((video) => ({
    videoUid: video.uid,
    hlsUrl: buildRecordingHlsPlaybackUrl(customerCode, video.uid),
    recordedAt: video.created || video.uploaded || null,
    durationSeconds: recordingDurationSeconds(video),
    metaName: video?.meta?.name || null,
  }));
}

export async function fetchLatestCloudflareRecording(env, inputId) {
  const recordings = await fetchLiveInputRecordings(env, inputId);
  const latest = recordings[0];
  if (!latest?.videoUid) return null;

  return {
    videoUid: latest.videoUid,
    hlsUrl: latest.hlsUrl,
    created: latest.recordedAt,
  };
}

export async function deleteCloudflareVideo(env, videoUid) {
  if (!videoUid) return false;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) return false;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoUid}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const payload = await response.json().catch(() => ({}));
  return response.ok && payload.success;
}

export async function getOrCreateMp4Download(env, videoUid) {
  if (!videoUid) return { status: 'unavailable', url: null };

  let downloads = await cloudflareStreamFetch(env, `${videoUid}/downloads`);
  let entry = downloads?.default;

  if (!entry) {
    downloads = await cloudflareStreamFetch(env, `${videoUid}/downloads`, { method: 'POST' });
    entry = downloads?.default;
  }

  if (!entry) {
    return { status: 'unavailable', url: null };
  }

  const status = entry.status === 'ready' ? 'ready' : 'inprogress';
  return {
    status,
    url: entry.url || null,
    percentComplete: entry.percentComplete ?? null,
  };
}

export async function createCloudflareLiveInput(env, name) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error('Cloudflare Stream is not configured on the server');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: { name: name || 'Simple Streamz Live' },
        // automatic is required for HLS/DASH playback while live (mode "off" = ingest only)
        recording: { mode: 'automatic' },
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const message = payload.errors?.[0]?.message || 'Cloudflare Stream API failed';
    throw new Error(message);
  }

  const result = payload.result;
  const inputId = result.uid;
  const rtmpsUrl = normalizeCloudflareRtmpsIngestUrl(result.rtmps?.url);
  const streamKey = result.rtmps?.streamKey;
  const hlsUrl = buildHlsPlaybackUrl(env.CLOUDFLARE_STREAM_CUSTOMER_CODE, inputId);

  if (!streamKey || !inputId) {
    throw new Error('Cloudflare did not return stream credentials');
  }

  return {
    cloudflare_input_id: inputId,
    key_value: streamKey,
    rtmp_ingest_url: rtmpsUrl,
    hls_playback_url: hlsUrl,
  };
}

/** Live inputs created with recording mode "off" accept RTMPS but cannot play in HLS embeds. */
export async function enableCloudflareLiveInputPlayback(env, inputId) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token || !inputId) return false;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${inputId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recording: { mode: 'automatic' },
      }),
    }
  );

  const payload = await response.json().catch(() => ({}));
  return response.ok && payload.success;
}

export async function deleteCloudflareLiveInput(env, inputId) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token || !inputId) return;

  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${inputId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}
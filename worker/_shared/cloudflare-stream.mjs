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

export function pickLatestReadyRecording(videos) {
  if (!Array.isArray(videos)) return null;

  const ready = videos.filter((video) => video?.status?.state === 'ready' && video?.uid);
  if (!ready.length) return null;

  ready.sort((a, b) => {
    const aTime = Date.parse(a.created || a.uploaded || 0) || 0;
    const bTime = Date.parse(b.created || b.uploaded || 0) || 0;
    return bTime - aTime;
  });

  return ready[0];
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

export async function fetchCloudflareLiveInputStatus(env, inputId) {
  if (!inputId) return { connected: false };

  const result = await cloudflareStreamFetch(env, `live_inputs/${inputId}`);
  if (!result) return { connected: false };

  const status = String(result.status || '').toLowerCase();
  return { connected: status === 'connected' };
}

export async function fetchLatestCloudflareRecording(env, inputId) {
  if (!inputId) return null;

  const videos = await cloudflareStreamFetch(env, `live_inputs/${inputId}/videos`);
  const latest = pickLatestReadyRecording(videos);
  if (!latest?.uid) return null;

  return {
    videoUid: latest.uid,
    hlsUrl: buildRecordingHlsPlaybackUrl(env.CLOUDFLARE_STREAM_CUSTOMER_CODE, latest.uid),
    created: latest.created || latest.uploaded || null,
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
import {
  deleteCloudflareVideo,
  fetchLiveInputRecordings,
  getOrCreateMp4Download,
} from './cloudflare-stream.mjs';
import {
  buildRetentionSummary,
  buildRetentionUsage,
  DEFAULT_RETENTION,
  RETENTION_BY_TIER,
} from './sermon-retention.mjs';
import { getPlatformAccess } from './subscription-access.mjs';
import { supabaseDelete, supabaseInsert, supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

function formatRecordingTitle(streamName, recordedAt) {
  const label = streamName?.trim() || 'Service';
  const date = recordedAt ? new Date(recordedAt) : new Date();
  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${label} – ${formatted}`;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export async function resolveSermonRetentionPolicy(env, userId) {
  const access = await getPlatformAccess(env, userId);
  if (access.isAdmin) {
    return { ...RETENTION_BY_TIER.Enterprise, tierName: 'Admin' };
  }

  const subscription = access.subscription;
  let tierName = subscription?.tier_name || null;

  if (!tierName && subscription?.subscription_tier_id) {
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `id=eq.${subscription.subscription_tier_id}&select=name&limit=1`
    );
    tierName = tiers?.[0]?.name || null;
  }

  const policy = RETENTION_BY_TIER[tierName] || DEFAULT_RETENTION;
  return { ...policy, tierName: tierName || 'Trial' };
}

async function getRecordingById(env, recordingId, userId) {
  const rows =
    (await supabaseSelect(
      env,
      'sermon_recordings',
      `id=eq.${recordingId}&user_id=eq.${userId}&select=*&limit=1`
    )) ?? [];
  return rows[0] || null;
}

export async function syncStreamKeyRecordings(env, streamKey) {
  if (!streamKey?.cloudflare_input_id || !streamKey?.user_id) {
    return { inserted: 0, scanned: 0 };
  }

  const recordings = await fetchLiveInputRecordings(env, streamKey.cloudflare_input_id);
  let inserted = 0;

  for (const recording of recordings) {
    const existing =
      (await supabaseSelect(
        env,
        'sermon_recordings',
        `cloudflare_video_uid=eq.${encodeURIComponent(recording.videoUid)}&select=id&limit=1`
      )) ?? [];

    if (existing.length > 0) continue;

    const recordedAt = recording.recordedAt || new Date().toISOString();
    await supabaseInsert(env, 'sermon_recordings', {
      user_id: streamKey.user_id,
      stream_key_id: streamKey.id,
      cloudflare_video_uid: recording.videoUid,
      stream_name: streamKey.stream_name,
      title: formatRecordingTitle(streamKey.stream_name, recordedAt),
      recorded_at: recordedAt,
      duration_seconds: recording.durationSeconds,
      hls_playback_url: recording.hlsUrl,
    });
    inserted += 1;
  }

  return { inserted, scanned: recordings.length };
}

export async function enforceSermonRetentionForUser(env, userId) {
  const policy = await resolveSermonRetentionPolicy(env, userId);
  const rows =
    (await supabaseSelect(
      env,
      'sermon_recordings',
      `user_id=eq.${userId}&select=*&order=recorded_at.desc`
    )) ?? [];

  const cutoffMs = Date.now() - policy.retentionDays * 86400000;
  const toDelete = [];

  rows.forEach((row, index) => {
    const tooOld = Date.parse(row.recorded_at) < cutoffMs;
    const overCount = index >= policy.maxRecordings;
    if (tooOld || overCount) toDelete.push(row);
  });

  for (const row of toDelete) {
    await deleteCloudflareVideo(env, row.cloudflare_video_uid);
    await supabaseDelete(env, 'sermon_recordings', `id=eq.${row.id}`);
  }

  return { deleted: toDelete.length, policy };
}

export async function syncUserSermonLibrary(env, userId) {
  const streamKeys =
    (await supabaseSelect(
      env,
      'stream_keys',
      `user_id=eq.${userId}&status=neq.revoked&cloudflare_input_id=not.is.null&select=*`
    )) ?? [];

  let inserted = 0;
  let scanned = 0;

  for (const streamKey of streamKeys) {
    const result = await syncStreamKeyRecordings(env, streamKey);
    inserted += result.inserted;
    scanned += result.scanned;
  }

  const retention = await enforceSermonRetentionForUser(env, userId);
  return { inserted, scanned, retention };
}

export async function listUserSermonRecordings(env, userId) {
  await syncUserSermonLibrary(env, userId);

  const [rows, policy] = await Promise.all([
    supabaseSelect(
      env,
      'sermon_recordings',
      `user_id=eq.${userId}&select=id,stream_key_id,stream_name,title,recorded_at,duration_seconds,hls_playback_url,mp4_status,created_at&order=recorded_at.desc`
    ),
    resolveSermonRetentionPolicy(env, userId),
  ]);

  const recordings = (rows ?? []).map((row) => ({
    id: row.id,
    stream_key_id: row.stream_key_id,
    stream_name: row.stream_name,
    title: row.title,
    recorded_at: row.recorded_at,
    duration_seconds: row.duration_seconds,
    duration_label: formatDuration(row.duration_seconds),
    hls_playback_url: row.hls_playback_url,
    mp4_status: row.mp4_status,
    can_download: true,
  }));

  const usage = buildRetentionUsage(rows ?? [], policy);

  return {
    recordings,
    retention: {
      ...buildRetentionSummary(policy),
      usage,
    },
  };
}

export async function getSermonRetentionUsage(env, userId) {
  const [rows, policy] = await Promise.all([
    supabaseSelect(
      env,
      'sermon_recordings',
      `user_id=eq.${userId}&select=id,title,recorded_at&order=recorded_at.desc`
    ),
    resolveSermonRetentionPolicy(env, userId),
  ]);

  const usage = buildRetentionUsage(rows ?? [], policy);

  return {
    retention: {
      ...buildRetentionSummary(policy),
      usage,
    },
  };
}

export async function deleteSermonRecording(env, userId, recordingId) {
  const recording = await getRecordingById(env, recordingId, userId);
  if (!recording) {
    throw new Error('Recording not found');
  }

  if (recording.cloudflare_video_uid) {
    await deleteCloudflareVideo(env, recording.cloudflare_video_uid);
  }
  await supabaseDelete(env, 'sermon_recordings', `id=eq.${recording.id}`);

  return { deleted: true, id: recording.id, title: recording.title };
}

export async function prepareSermonDownload(env, userId, recordingId) {
  const recording = await getRecordingById(env, recordingId, userId);
  if (!recording) {
    throw new Error('Recording not found');
  }

  if (recording.mp4_status === 'ready' && recording.mp4_download_url) {
    return {
      status: 'ready',
      url: recording.mp4_download_url,
      title: recording.title,
    };
  }

  const download = await getOrCreateMp4Download(env, recording.cloudflare_video_uid);
  if (!download.url) {
    throw new Error('Download is not available for this recording yet');
  }

  const patch = {
    mp4_download_url: download.url,
    mp4_status: download.status === 'ready' ? 'ready' : 'inprogress',
  };
  await supabaseUpdate(env, 'sermon_recordings', `id=eq.${recording.id}`, patch);

  return {
    status: download.status,
    url: download.status === 'ready' ? download.url : null,
    title: recording.title,
    percentComplete: download.percentComplete,
  };
}

export async function runSermonLibraryCron(env) {
  const streamKeys =
    (await supabaseSelect(
      env,
      'stream_keys',
      'status=eq.active&cloudflare_input_id=not.is.null&select=*&limit=200'
    )) ?? [];

  const userIds = [...new Set(streamKeys.map((key) => key.user_id))];
  let inserted = 0;
  let deleted = 0;

  for (const streamKey of streamKeys) {
    const result = await syncStreamKeyRecordings(env, streamKey);
    inserted += result.inserted;
  }

  for (const userId of userIds) {
    const retention = await enforceSermonRetentionForUser(env, userId);
    deleted += retention.deleted;
  }

  return { streamKeys: streamKeys.length, users: userIds.length, inserted, deleted };
}
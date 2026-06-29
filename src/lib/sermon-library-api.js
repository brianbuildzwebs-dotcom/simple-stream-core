import { authJsonHeaders } from '@/lib/api-auth';

function handleSubscriptionRequired(response, payload) {
  if (response.status === 402 && payload.code === 'subscription_required') {
    window.location.assign('/paywall');
    throw new Error(payload.error || 'Subscription required');
  }
}

export async function fetchSermonRetentionUsage() {
  const response = await fetch('/api/sermons/usage', {
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load sermon usage');
  }
  return payload;
}

export async function fetchSermonLibrary() {
  const response = await fetch('/api/sermons', {
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load sermon library');
  }
  return payload;
}

export async function requestSermonDownload(recordingId) {
  const response = await fetch(`/api/sermons/download?id=${encodeURIComponent(recordingId)}`, {
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to prepare download');
  }
  return payload;
}

export async function deleteSermonRecording(recordingId) {
  const response = await fetch(`/api/sermons?id=${encodeURIComponent(recordingId)}`, {
    method: 'DELETE',
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to delete recording');
  }
  return payload;
}

export async function waitForSermonDownload(recordingId, { attempts = 40, delayMs = 3000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await requestSermonDownload(recordingId);
    if (result.status === 'ready' && result.url) {
      return result;
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Download is still preparing. Try again in a minute.');
}

function sermonFilename(title) {
  const base = String(title || 'sermon')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return `${base || 'sermon'}.mp4`;
}

/** Streams MP4 through our API so the browser saves locally (no popups or signed-URL hacks). */
export async function downloadSermonRecordingFile(recordingId, title) {
  await waitForSermonDownload(recordingId);

  const response = await fetch(
    `/api/sermons/download?id=${encodeURIComponent(recordingId)}&deliver=1`,
    { headers: await authJsonHeaders() }
  );

  if (response.status === 202) {
    throw new Error('Download is still preparing. Try again in a minute.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Download failed');
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = sermonFilename(title);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
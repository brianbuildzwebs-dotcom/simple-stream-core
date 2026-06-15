import { authJsonHeaders } from '@/lib/api-auth';
import { APP_NAME } from '@/lib/brand';

export function buildEmbedUrl(trackingCode) {
  return `${window.location.origin}/embed?code=${trackingCode}`;
}

export function buildEmbedIframeHtml(trackingCode) {
  const embedUrl = buildEmbedUrl(trackingCode);
  return `<iframe src="${embedUrl}" title="${APP_NAME} Player" width="100%" style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px;overflow:hidden;" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>`;
}

export async function fetchEmbedConfig(trackingCode) {
  const response = await fetch(`/api/embed/config?code=${encodeURIComponent(trackingCode)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load embed');
  }
  return payload;
}

export async function logEmbedView(trackingCode) {
  try {
    await fetch('/api/embed/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_code: trackingCode }),
    });
  } catch {
    // non-blocking analytics
  }
}

export async function createEmbedInstance({
  name,
  videoSourceType,
  videoSourceUrl,
  streamKeyId,
}) {
  const response = await fetch('/api/embeds', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({
      name: name.trim(),
      video_source_type: videoSourceType,
      video_source_url: videoSourceUrl || null,
      stream_key_id: streamKeyId || null,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to create embed');
  }
  return payload.embed;
}

export async function updateEmbedInstance(id, patch) {
  const response = await fetch(`/api/embeds?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: await authJsonHeaders(),
    body: JSON.stringify(patch),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to update embed');
  }
  return payload.embed;
}

export async function deleteEmbedInstance(id) {
  const response = await fetch(`/api/embeds?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to delete embed');
  }
}
import { authJsonHeaders } from '@/lib/api-auth';
import { APP_NAME } from '@/lib/brand';

function handleSubscriptionRequired(response, payload) {
  if (response.status === 402 && payload.code === 'subscription_required') {
    window.location.assign('/paywall');
    throw new Error(payload.error || 'Subscription required');
  }
}

export function normalizeTrackingCode(trackingCode) {
  return String(trackingCode || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

export function buildEmbedUrl(trackingCode) {
  const code = normalizeTrackingCode(trackingCode);
  if (!code) return `${window.location.origin}/embed`;
  return `${window.location.origin}/embed/c/${encodeURIComponent(code)}`;
}

export const EMBED_HOST_SCRIPT_VERSION = '16';

export function buildEmbedHostScriptUrl() {
  if (typeof window === 'undefined') return `/embed-host.js?v=${EMBED_HOST_SCRIPT_VERSION}`;
  return `${window.location.origin}/embed-host.js?v=${EMBED_HOST_SCRIPT_VERSION}`;
}

export function buildEmbedIframeHtml(trackingCode) {
  const code = normalizeTrackingCode(trackingCode);
  const embedUrl = buildEmbedUrl(code);
  const hostScriptUrl = buildEmbedHostScriptUrl();
  const iframeId = `simple-streamz-${code || 'player'}`;
  return `<style>
@media (max-width:926px),(orientation:landscape) and (max-height:520px){
  .simple-streamz-embed{width:100vw!important;max-width:100vw!important;margin-left:calc(50% - 50vw)!important;margin-right:calc(50% - 50vw)!important;padding:0!important;box-sizing:border-box!important;position:relative!important}
  .simple-streamz-embed iframe{width:100%!important;min-width:100%!important;max-width:100%!important;border-radius:0!important;display:block!important}
}
</style>
<div class="simple-streamz-embed" style="width:100%;max-width:100%;min-width:0;margin:0;padding:0;box-sizing:border-box;">
<iframe id="${iframeId}" src="${embedUrl}" title="${APP_NAME} Player" width="100%" style="width:100%;max-width:100%;min-width:100%;aspect-ratio:16/9;border:0;border-radius:12px;overflow:hidden;display:block;" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>
</div>
<script src="${hostScriptUrl}" data-frame="${iframeId}" defer><\/script>`;
}

function resolveEmbedViewHost() {
  if (typeof window === 'undefined') return '';
  try {
    if (document.referrer) {
      return new URL(document.referrer).hostname;
    }
  } catch {
    // fall through to current host
  }
  return window.location.hostname || '';
}

export async function fetchEmbedConfig(trackingCode) {
  const params = new URLSearchParams({ code: trackingCode });
  const host = resolveEmbedViewHost();
  if (host) {
    params.set('host', host);
  }
  const response = await fetch(`/api/embed/config?${params.toString()}`);
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
  handleSubscriptionRequired(response, payload);
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
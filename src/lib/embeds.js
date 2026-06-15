import { supabase } from '@/lib/supabase';
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
  userId,
  name,
  videoSourceType,
  videoSourceUrl,
  streamKeyId,
}) {
  const trackingCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const { data, error } = await supabase
    .from('embed_instances')
    .insert({
      user_id: userId,
      tracking_code: trackingCode,
      name: name.trim(),
      video_source_type: videoSourceType,
      video_source_url: videoSourceUrl || null,
      stream_key_id: streamKeyId || null,
      is_watermark_enabled: true,
      watermark_text: `© ${APP_NAME}`,
      watermark_position: 'bottom_right',
      watermark_size: 'medium',
      watermark_opacity: 0.7,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateEmbedInstance(id, patch) {
  const { data, error } = await supabase
    .from('embed_instances')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEmbedInstance(id) {
  const { error } = await supabase.from('embed_instances').delete().eq('id', id);
  if (error) throw error;
}
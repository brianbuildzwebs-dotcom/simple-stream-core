import { supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

function parseYoutubeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const videoId = parsed.searchParams.get('v');
    if (videoId) return { type: 'youtube', url, videoId, isLive: /live/i.test(url) };
    const shorts = parsed.pathname.match(/\/shorts\/([^/]+)/);
    if (shorts) return { type: 'youtube', url, videoId: shorts[1] };
    const embed = parsed.pathname.match(/\/embed\/([^/]+)/);
    if (embed) return { type: 'youtube', url, videoId: embed[1] };
    const live = parsed.pathname.match(/\/live\/([^/]+)/);
    if (live) return { type: 'youtube', url, videoId: live[1], isLive: true };
  } catch {
    return null;
  }
  return null;
}

function domainAllowed(referer, allowedDomains) {
  if (!allowedDomains?.length) return true;
  let host = '';
  try {
    host = new URL(referer).hostname;
  } catch {
    return false;
  }
  return allowedDomains.some((entry) => {
    const domain = entry.trim().toLowerCase();
    if (!domain) return false;
    if (domain === '*') return true;
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(1);
      return host === domain.slice(2) || host.endsWith(suffix);
    }
    return host === domain || host.endsWith(`.${domain}`);
  });
}

export async function resolveEmbedConfig(env, trackingCode, referer) {
  const rows = await supabaseSelect(
    env,
    'embed_instances',
    `tracking_code=eq.${encodeURIComponent(trackingCode)}&is_active=eq.true&select=*`
  );
  const embed = rows?.[0];
  if (!embed) return { error: 'Embed not found', status: 404 };

  if (!domainAllowed(referer, embed.allowed_domains)) {
    return { error: 'Domain not allowed', status: 403 };
  }

  let source = null;

  if (embed.video_source_type === 'youtube') {
    source = parseYoutubeUrl(embed.video_source_url);
  }

  if (embed.video_source_type === 'rtmp' && embed.stream_key_id) {
    const keys = await supabaseSelect(
      env,
      'stream_keys',
      `id=eq.${embed.stream_key_id}&select=*`
    );
    const key = keys?.[0];
    if (key?.hls_playback_url && key?.key_value) {
      source = {
        type: 'rtmp',
        provider: 'cloudflare',
        streamKey: key.key_value,
        hlsUrl: key.hls_playback_url,
        url: key.hls_playback_url,
        label: key.stream_name || embed.name,
      };
    }
  }

  if (embed.video_source_type === 'upload' && embed.video_source_url) {
    source = {
      type: 'file',
      url: embed.video_source_url,
      fileName: embed.name || 'Video',
    };
  }

  if (!source) {
    return { error: 'Embed source not configured', status: 422 };
  }

  const showWatermark = embed.is_watermark_enabled !== false;

  return {
    status: 200,
    body: {
      trackingCode,
      name: embed.name,
      source,
      watermark: showWatermark
        ? {
            enabled: true,
            text: embed.watermark_text || '© Simple Streamz',
            position: embed.watermark_position || 'bottom_right',
            size: embed.watermark_size || 'medium',
            opacity: embed.watermark_opacity ?? 0.7,
          }
        : { enabled: false },
    },
  };
}

export async function recordEmbedView(env, trackingCode) {
  const rows = await supabaseSelect(
    env,
    'embed_instances',
    `tracking_code=eq.${encodeURIComponent(trackingCode)}&select=id,total_views`
  );
  const embed = rows?.[0];
  if (!embed) return;

  await supabaseUpdate(env, 'embed_instances', `id=eq.${embed.id}`, {
    total_views: (embed.total_views || 0) + 1,
  });
}
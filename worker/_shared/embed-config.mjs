import {
  buildHlsPlaybackUrl,
  enableCloudflareLiveInputPlayback,
  fetchCloudflareLiveInputStatus,
  fetchLatestCloudflareRecording,
} from './cloudflare-stream.mjs';
import { resolveOwnerWatermarkPolicy } from './subscription-access.mjs';
import { getUserServiceSchedule, serializeScheduleForEmbed } from './service-schedule.mjs';
import { supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';
import { parseYoutubeUrl } from './youtube-url.mjs';

function hostFromReferer(referer) {
  if (!referer) return '';
  try {
    return new URL(referer).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function hostFromOrigin(origin) {
  if (!origin) return '';
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isBrowserEmbedRequest(secFetchSite) {
  const mode = String(secFetchSite || '').trim().toLowerCase();
  return mode === 'same-origin' || mode === 'same-site' || mode === 'cross-site';
}

export function resolveTrustedPlaybackHost(referer, origin, viewHost, secFetchSite = '') {
  const refererHost = hostFromReferer(referer);
  const originHost = hostFromOrigin(origin);
  const claimedHost = String(viewHost || '').trim().toLowerCase();

  if (refererHost && !isPlatformPreviewHost(refererHost)) {
    return refererHost;
  }

  if (originHost && isPlatformPreviewHost(originHost)) {
    if (claimedHost && isBrowserEmbedRequest(secFetchSite)) {
      return claimedHost;
    }
    return refererHost || originHost || '';
  }

  if (isPlatformPreviewHost(refererHost)) {
    return refererHost || originHost || '';
  }

  return '';
}

function hostMatchesDomainPattern(host, pattern) {
  const domain = String(pattern || '').trim().toLowerCase();
  const normalizedHost = String(host || '').trim().toLowerCase();
  if (!domain || !normalizedHost) return false;
  if (domain === '*') return true;
  if (domain.startsWith('*.')) {
    const suffix = domain.slice(1);
    const bare = domain.slice(2);
    return normalizedHost === bare || normalizedHost.endsWith(suffix);
  }
  return normalizedHost === domain || normalizedHost.endsWith(`.${domain}`);
}

function domainAllowed(referer, allowedDomains) {
  if (!allowedDomains?.length) return true;
  const host = hostFromReferer(referer);
  if (!host) return false;
  return allowedDomains.some((entry) => hostMatchesDomainPattern(host, entry));
}

function isPlatformPreviewHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === 'simplestreamz.io' ||
    normalized.endsWith('.simplestreamz.io') ||
    normalized.endsWith('.workers.dev') ||
    normalized.endsWith('.pages.dev')
  );
}

function normalizeTrackingCode(trackingCode) {
  return String(trackingCode || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

async function fetchEmbedByTrackingCode(env, trackingCode) {
  const raw = String(trackingCode || '').trim();
  const normalized = normalizeTrackingCode(raw);
  if (!normalized) {
    return { embed: null, error: 'Embed code is required' };
  }

  const candidates = [...new Set([normalized, raw.toLowerCase(), raw].filter(Boolean))];

  for (const code of candidates) {
    const rows = await supabaseSelect(
      env,
      'embed_instances',
      `tracking_code=eq.${encodeURIComponent(code)}&select=*&limit=1`
    );
    if (rows === null) {
      return { embed: null, error: 'Could not load embed configuration', status: 500 };
    }
    if (rows[0]) {
      return { embed: rows[0] };
    }
  }

  return { embed: null };
}

export function resolveEmbedWatermarkVisible(embed, watermarkPolicy, isWhitelisted = false) {
  if (isWhitelisted) return false;
  if (watermarkPolicy.tierRequiresWatermark) return true;
  if (embed.is_watermark_enabled === false) return false;
  return embed.is_watermark_enabled === true;
}

async function isDomainWatermarkExempt(env, host) {
  if (!host) return false;

  const rows = await supabaseSelect(
    env,
    'domain_whitelist',
    'is_active=eq.true&select=domain'
  );

  return (rows ?? []).some((row) => hostMatchesDomainPattern(host, row.domain));
}

export async function resolveEmbedConfig(
  env,
  trackingCode,
  referer,
  viewHost = '',
  { origin = '', secFetchSite = '' } = {}
) {
  const lookup = await fetchEmbedByTrackingCode(env, trackingCode);
  if (lookup.error) {
    return { error: lookup.error, status: lookup.status || 500 };
  }

  const embed = lookup.embed;
  if (!embed) {
    return { error: 'Embed not found. Check the embed code in Embed Manager.', status: 404 };
  }

  if (embed.is_active === false) {
    return { error: 'This embed is inactive. Reactivate it in Embed Manager.', status: 404 };
  }

  const playbackHost = resolveTrustedPlaybackHost(referer, origin, viewHost, secFetchSite);
  const domainCheckReferer = playbackHost ? `https://${playbackHost}/` : referer;
  const platformPreview = isPlatformPreviewHost(playbackHost);

  if (!platformPreview && !domainAllowed(domainCheckReferer, embed.allowed_domains)) {
    return {
      error:
        'Domain not allowed for this embed. Add your site domain in Embed Manager, or preview from Simple Streamz.',
      status: 403,
    };
  }

  let source = null;

  if (embed.video_source_type === 'youtube') {
    source = parseYoutubeUrl(embed.video_source_url);
  }

  if (embed.video_source_type === 'rtmp' && embed.stream_key_id) {
    const keys = await supabaseSelect(
      env,
      'stream_keys',
      `id=eq.${embed.stream_key_id}&select=id,status,cloudflare_input_id,hls_playback_url,stream_name`
    );
    const key = keys?.[0];
    if (key?.status === 'revoked') {
      return { error: 'Stream key was revoked. Create a new key and update this embed.', status: 422 };
    }
    if (key?.cloudflare_input_id) {
      await enableCloudflareLiveInputPlayback(env, key.cloudflare_input_id);
    }
    const hlsUrl =
      buildHlsPlaybackUrl(env.CLOUDFLARE_STREAM_CUSTOMER_CODE, key?.cloudflare_input_id) ||
      key?.hls_playback_url;
    if (hlsUrl) {
      const replayWhenOffline = embed.replay_when_offline === true;
      let playbackMode = 'holding';
      let replayHlsUrl = null;

      if (key.cloudflare_input_id) {
        const [liveStatus, latestRecording] = await Promise.all([
          fetchCloudflareLiveInputStatus(env, key.cloudflare_input_id),
          replayWhenOffline
            ? fetchLatestCloudflareRecording(env, key.cloudflare_input_id)
            : Promise.resolve(null),
        ]);

        if (liveStatus.connected) {
          playbackMode = 'live';
        } else if (replayWhenOffline && latestRecording?.hlsUrl) {
          playbackMode = 'replay';
          replayHlsUrl = latestRecording.hlsUrl;
        }
      }

      source = {
        type: 'rtmp',
        provider: 'cloudflare',
        hlsUrl,
        replayHlsUrl,
        playbackMode,
        replayWhenOffline,
        holdingTitle: embed.holding_title?.trim() || null,
        holdingMessage: embed.holding_message?.trim() || null,
        url: playbackMode === 'replay' && replayHlsUrl ? replayHlsUrl : hlsUrl,
        inputId: key.cloudflare_input_id,
        customerCode: env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
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
    if (embed.video_source_type === 'youtube') {
      return {
        error:
          'Invalid YouTube URL. Use a video link (watch?v=…) or playlist link (playlist?list=…).',
        status: 422,
      };
    }
    if (embed.video_source_type === 'rtmp') {
      return {
        error:
          'Stream is not ready yet. Open Stream Keys, confirm the key is active, then re-link it in Embed Manager.',
        status: 422,
      };
    }
    return { error: 'Embed source not configured', status: 422 };
  }

  const [watermarkPolicy, isWhitelisted, serviceSchedule] = await Promise.all([
    resolveOwnerWatermarkPolicy(env, embed.user_id),
    isDomainWatermarkExempt(env, playbackHost),
    getUserServiceSchedule(env, embed.user_id).then(serializeScheduleForEmbed).catch(() => null),
  ]);
  const showWatermark = resolveEmbedWatermarkVisible(embed, watermarkPolicy, isWhitelisted);

  if (source?.type === 'rtmp' && serviceSchedule) {
    source.serviceSchedule = serviceSchedule;
  }

  return {
    status: 200,
    body: {
      trackingCode,
      embedId: embed.id,
      ownerUserId: embed.user_id,
      chatEnabled: embed.chat_enabled !== false,
      giveEnabled: embed.give_enabled === true,
      giveUrl: embed.give_url?.trim() || null,
      giveLabel: embed.give_label?.trim() || 'Give',
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
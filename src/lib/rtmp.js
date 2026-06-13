/** Cloudflare RTMPS keys: hex ingest token + "k" + hex live input id. */
export const CLOUDFLARE_STREAM_KEY_RE = /^[a-f0-9]{20,64}k[a-f0-9]{20,64}$/;

/** Extract and normalize a Cloudflare stream key from pasted text. */
export function normalizeStreamKey(input) {
  const raw = input?.trim() || '';
  if (!raw) return '';

  const fromUrl = raw.match(/\/live\/([a-f0-9]+k[a-f0-9]+)\/?$/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();

  return raw.replace(/\s/g, '').toLowerCase();
}

export function isValidStreamKey(input) {
  return CLOUDFLARE_STREAM_KEY_RE.test(normalizeStreamKey(input));
}

export function validateStreamKey(input) {
  const raw = input?.trim() || '';
  const key = normalizeStreamKey(raw);

  if (!key) {
    return { valid: false, error: 'Stream key is required.', key: '' };
  }
  if (/^rtmps?:\/\//i.test(raw) && !CLOUDFLARE_STREAM_KEY_RE.test(key)) {
    return {
      valid: false,
      error: 'Could not read a stream key from that URL. Paste the key from Cloudflare Stream → Live input.',
      key,
    };
  }
  if (/[/?#:&]/.test(raw) && !/^rtmps?:\/\//i.test(raw)) {
    return {
      valid: false,
      error: 'Paste the stream key only — not an HLS or RTMP URL.',
      key,
    };
  }
  if (!CLOUDFLARE_STREAM_KEY_RE.test(key)) {
    return {
      valid: false,
      error: 'Invalid stream key. It should look like abc123…kdef456… (hex characters with a k in the middle).',
      key,
    };
  }
  return { valid: true, error: '', key };
}

export function validateHlsManifestUrl(input) {
  const url = input?.trim() || '';
  if (!url) return { valid: true, error: '', url: '' };
  if (!parseHlsManifestUrl(url)) {
    return {
      valid: false,
      error: 'Invalid HLS URL. Paste the manifest URL from Cloudflare Stream → Playback.',
      url,
    };
  }
  return { valid: true, error: '', url };
}

/** Live input ID is the segment after the last "k" in the Cloudflare stream key. */
export function getLiveInputId(streamKey) {
  const key = normalizeStreamKey(streamKey);
  if (!key?.includes('k')) return null;
  return key.split('k').pop() || null;
}

/** Build HLS manifest URL from live input ID + customer code. */
export function buildHlsUrlFromInputId(inputId, customerCode) {
  const id = inputId?.trim();
  const code = customerCode?.trim();
  if (!id || !code) return null;
  return `https://customer-${code}.cloudflarestream.com/${id}/manifest/video.m3u8`;
}

/** Build HLS manifest URL from stream key + customer code. */
export function buildHlsUrlFromKey(streamKey, customerCode) {
  return buildHlsUrlFromInputId(getLiveInputId(streamKey), customerCode);
}

export function resolveHlsUrl(streamKey, hlsUrlOverride, inputIdOverride, customerCode) {
  const override = hlsUrlOverride?.trim();
  if (override) return override;
  const fromInput = buildHlsUrlFromInputId(inputIdOverride, customerCode);
  if (fromInput) return fromInput;
  if (customerCode) return buildHlsUrlFromKey(streamKey, customerCode);
  return null;
}

export function buildRtmpSource(streamKey, hlsUrlOverride, inputIdOverride, customerCode) {
  const key = normalizeStreamKey(streamKey);
  const hlsUrl = resolveHlsUrl(key, hlsUrlOverride, inputIdOverride, customerCode);
  return {
    type: 'rtmp',
    provider: 'cloudflare',
    streamKey: key,
    hlsUrl,
    url: hlsUrl || `cloudflare:${key}`,
  };
}

export function normalizeRtmpServerUrl(input) {
  const raw = input?.trim() || '';
  if (!raw) return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export function validateRtmpServerUrl(input) {
  const url = normalizeRtmpServerUrl(input);
  if (!url) {
    return { valid: false, error: 'RTMPS server URL is required.', url: '' };
  }
  if (!/^rtmps?:\/\//i.test(url)) {
    return {
      valid: false,
      error: 'Server URL must start with rtmp:// or rtmps://',
      url,
    };
  }
  return { valid: true, error: '', url };
}

export function validateCustomStreamKey(input) {
  const key = input?.trim() || '';
  if (!key) {
    return { valid: false, error: 'Stream key is required.', key: '' };
  }
  if (key.length > 500) {
    return { valid: false, error: 'Stream key is too long.', key };
  }
  return { valid: true, error: '', key };
}

export function validateGenericHlsUrl(input) {
  const url = input?.trim() || '';
  if (!url) {
    return {
      valid: false,
      error: 'HLS playback URL is required — browsers cannot play raw RTMPS.',
      url: '',
    };
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'HLS URL must use http:// or https://', url };
    }
  } catch {
    return { valid: false, error: 'Enter a valid HLS manifest URL (https://.../video.m3u8).', url };
  }
  return { valid: true, error: '', url };
}

export function buildCustomRtmpSource(serverUrl, streamKey, hlsUrl, label = '') {
  const server = normalizeRtmpServerUrl(serverUrl);
  const key = streamKey.trim();
  const playback = hlsUrl.trim();
  const cleanLabel = label?.trim() || null;

  return {
    type: 'rtmp',
    provider: 'custom',
    serverUrl: server,
    streamKey: key,
    hlsUrl: playback,
    label: cleanLabel,
    url: `${server}|${key}|${playback}`,
  };
}

export function getObsInstructions(sourceOrKey) {
  if (typeof sourceOrKey === 'object' && sourceOrKey?.type === 'rtmp') {
    return {
      server: sourceOrKey.serverUrl || '(RTMPS server URL)',
      key: sourceOrKey.streamKey || '(stream key)',
    };
  }

  return {
    server: '(RTMPS server URL)',
    key: '(stream key)',
  };
}

export function isCloudflareRtmpSource(source) {
  return source?.type === 'rtmp' && source?.provider !== 'custom';
}

const HLS_MANIFEST_RE =
  /^https:\/\/customer-([a-z0-9]+)\.cloudflarestream\.com\/([a-f0-9]+)\/manifest\/video\.m3u8$/i;

/** Parse customer code + UID from a Cloudflare Stream HLS manifest URL. */
export function parseHlsManifestUrl(hlsUrl) {
  const match = hlsUrl?.trim().match(HLS_MANIFEST_RE);
  if (!match) return null;
  return { customerCode: match[1], uid: match[2] };
}

export function buildHlsManifestUrl(customerCode, uid) {
  return `https://customer-${customerCode}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

/** Public lifecycle endpoint — shows whether Cloudflare is receiving ingest. */
export async function fetchLiveLifecycle(customerCode, inputId) {
  const res = await fetch(
    `https://customer-${customerCode}.cloudflarestream.com/${inputId}/lifecycle`
  );
  if (!res.ok) return null;
  return res.json();
}
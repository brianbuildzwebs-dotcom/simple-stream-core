export const RTMP_SERVER_URL =
  import.meta.env.VITE_RTMP_SERVER_URL ?? 'rtmps://live.cloudflare.com:443/live/';

export const RTMP_STREAM_KEY = import.meta.env.VITE_RTMP_STREAM_KEY ?? '';

export const RTMP_HLS_URL = import.meta.env.VITE_RTMP_HLS_URL ?? '';

export const RTMP_CUSTOMER_CODE = import.meta.env.VITE_RTMP_CUSTOMER_CODE ?? '';

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
export function buildHlsUrlFromInputId(inputId) {
  const id = inputId?.trim();
  if (!id || !RTMP_CUSTOMER_CODE) return null;
  return `https://customer-${RTMP_CUSTOMER_CODE}.cloudflarestream.com/${id}/manifest/video.m3u8`;
}

/** Build HLS manifest URL from stream key + customer code when env URL is missing. */
export function buildHlsUrlFromKey(streamKey) {
  return buildHlsUrlFromInputId(getLiveInputId(streamKey));
}

export function resolveHlsUrl(streamKey, hlsUrlOverride, inputIdOverride) {
  const override = hlsUrlOverride?.trim();
  if (override) return override;
  const fromInput = buildHlsUrlFromInputId(inputIdOverride);
  if (fromInput) return fromInput;
  if (RTMP_HLS_URL) return RTMP_HLS_URL;
  return buildHlsUrlFromKey(streamKey);
}

export function buildRtmpSource(streamKey, hlsUrlOverride, inputIdOverride) {
  const key = normalizeStreamKey(streamKey);
  return {
    type: 'rtmp',
    streamKey: key,
    serverUrl: RTMP_SERVER_URL,
    hlsUrl: resolveHlsUrl(key, hlsUrlOverride, inputIdOverride),
  };
}

export function getObsInstructions(streamKey) {
  return {
    server: RTMP_SERVER_URL,
    key: streamKey || RTMP_STREAM_KEY || '(set VITE_RTMP_STREAM_KEY)',
  };
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
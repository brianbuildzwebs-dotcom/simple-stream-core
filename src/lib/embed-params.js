import { buildRtmpSource, RTMP_HLS_URL } from './rtmp';
import { isYoutubeLiveUrl } from './youtube';

/** Robustly extract the HLS URL from embed query strings (CMS often mangles encoding). */
export function parseHlsParam(search) {
  const params = new URLSearchParams(search);
  let hlsUrl = params.get('hls')?.trim() || '';

  if (hlsUrl && /^https?:\/\//i.test(hlsUrl)) {
    return hlsUrl;
  }

  const encoded = search.match(/[?&]hls=([^&]+)/)?.[1];
  if (encoded) {
    try {
      const decoded = decodeURIComponent(encoded).trim();
      if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {
      // fall through
    }
  }

  const raw = search.match(
    /[?&]hls=(https?%3A%2F%2F[^&]+|[hH][tT][tT][pP][sS]?:\/\/[^\s&]+)/i
  )?.[1];
  if (raw) {
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw.trim();
    }
  }

  return hlsUrl || '';
}

function defaultRtmpSource() {
  if (!RTMP_HLS_URL) return null;
  return buildRtmpSource('', RTMP_HLS_URL);
}

export function parseEmbedSource(search = '') {
  const trimmed = search?.trim() || '';
  if (!trimmed || trimmed === '?') {
    return defaultRtmpSource();
  }

  const params = new URLSearchParams(trimmed);
  const hlsFromQuery = parseHlsParam(trimmed);
  const inputIdParam = params.get('input');
  const type =
    params.get('source') || (hlsFromQuery || inputIdParam ? 'rtmp' : null);

  if (type === 'youtube') {
    const id = params.get('id');
    const list = params.get('list');
    const url = params.get('url') || '';
    const videoId = id && id !== 'null' ? id : null;
    const playlistId = list && list !== 'null' ? list : null;
    if (videoId || playlistId) {
      return {
        type: 'youtube',
        videoId,
        playlistId,
        url,
        isLive: isYoutubeLiveUrl(url) || params.get('live') === '1',
      };
    }
    return defaultRtmpSource();
  }

  if (type === 'file') {
    const url = params.get('url');
    const fileName = params.get('name') || 'Video';
    if (url) return { type: 'file', url, fileName };
    return defaultRtmpSource();
  }

  if (type === 'rtmp') {
    const streamKey = params.get('key') || '';
    const hlsUrl = hlsFromQuery || null;
    const inputId = inputIdParam;
    const source = buildRtmpSource(streamKey, hlsUrl, inputId);
    if (source.hlsUrl) return source;
    return defaultRtmpSource();
  }

  return defaultRtmpSource();
}
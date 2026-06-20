/** Stable chat thread key for embed players (one thread per embed). */
export function getEmbedChatSourceKey(embedId) {
  const id = embedId != null ? String(embedId).trim() : '';
  return id ? `embed:${id}` : null;
}

/** Primary chat key: embed id when available, otherwise source URL / stream identity. */
export function getChatSourceKey(source, embedId = null) {
  return getEmbedChatSourceKey(embedId) || getSourceKey(source);
}

/** One chat thread per loaded source URL / stream identity. */
export function getSourceKey(source) {
  if (!source?.type) return null;

  if (source.url?.trim()) {
    return `${source.type}:${source.url.trim()}`;
  }

  if (source.type === 'rtmp') {
    const key = source.streamKey?.trim();
    const hls = source.hlsUrl?.trim();
    if (key && hls) return `rtmp:${key}:${hls}`;
    if (key) return `rtmp:${key}`;
    if (hls) return `rtmp:hls:${hls}`;
  }

  if (source.type === 'file' && source.fileName) {
    return `file:${source.fileName}`;
  }

  if (source.type === 'youtube') {
    const parts = [];
    if (source.videoId) parts.push(`v=${source.videoId}`);
    if (source.playlistId) parts.push(`list=${source.playlistId}`);
    if (parts.length) return `youtube:${parts.join('&')}`;
  }

  return null;
}

export function matchesSourceKey(storedKey, sourceKey, legacySourceKey = null) {
  if (!storedKey) return false;
  if (sourceKey && storedKey === sourceKey) return true;
  if (legacySourceKey && storedKey === legacySourceKey) return true;
  return false;
}
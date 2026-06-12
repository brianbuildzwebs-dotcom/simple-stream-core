/** Normalize legacy + current keys so chat can match older rows. */
export function normalizeSourceKey(key) {
  if (!key) return null;

  return key
    .replace(/^youtube:video:/, 'youtube__v__')
    .replace(/^youtube:playlist:/, 'youtube__list__');
}

/** Stable id so chat is scoped per video/stream URL, not global. */
export function getSourceKey(source) {
  if (!source?.type) return null;

  if (source.type === 'youtube') {
    const parts = [];
    if (source.videoId) parts.push(`v__${source.videoId}`);
    if (source.playlistId) parts.push(`list__${source.playlistId}`);
    if (parts.length) return `youtube__${parts.join('__')}`;
    if (source.url) return `youtube__url__${source.url.trim()}`;
  }

  if (source.type === 'rtmp') {
    if (source.streamKey) return `rtmp__key__${source.streamKey}`;
    if (source.hlsUrl) return `rtmp__hls__${source.hlsUrl}`;
  }

  if (source.type === 'file') {
    if (source.url) return `file__${source.url}`;
    if (source.fileName) return `file__name__${source.fileName}`;
  }

  return null;
}

export function matchesSourceKey(storedKey, sourceKey) {
  if (!storedKey || !sourceKey) return false;
  return normalizeSourceKey(storedKey) === normalizeSourceKey(sourceKey);
}
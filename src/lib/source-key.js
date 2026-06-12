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

export function matchesSourceKey(storedKey, sourceKey) {
  return !!storedKey && !!sourceKey && storedKey === sourceKey;
}
/** Stable id so chat is scoped per video/stream, not global. */
export function getSourceKey(source) {
  if (!source?.type) return null;

  if (source.type === 'youtube') {
    if (source.playlistId && !source.videoId) {
      return `youtube:playlist:${source.playlistId}`;
    }
    if (source.videoId) {
      return `youtube:video:${source.videoId}`;
    }
    if (source.url) {
      return `youtube:url:${source.url.trim()}`;
    }
  }

  if (source.type === 'rtmp') {
    if (source.streamKey) return `rtmp:key:${source.streamKey}`;
    if (source.hlsUrl) return `rtmp:hls:${source.hlsUrl}`;
  }

  if (source.type === 'file') {
    if (source.url) return `file:${source.url}`;
    if (source.fileName) return `file:name:${source.fileName}`;
  }

  return null;
}
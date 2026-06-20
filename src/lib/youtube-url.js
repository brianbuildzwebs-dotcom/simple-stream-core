const VIDEO_ID_PATTERN =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;

export function parseYoutubeUrl(url) {
  if (!url) return null;

  const trimmed = String(url).trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const playlistId = parsed.searchParams.get('list') || null;
    let videoId = parsed.searchParams.get('v');

    if (!videoId) {
      const pathMatch = trimmed.match(VIDEO_ID_PATTERN);
      videoId = pathMatch?.[1] || null;
    }

    if (parsed.pathname.match(/\/playlist\//) && playlistId && !videoId) {
      return {
        type: 'youtube',
        url: trimmed,
        videoId: null,
        playlistId,
        isLive: false,
      };
    }

    if (videoId || playlistId) {
      return {
        type: 'youtube',
        url: trimmed,
        videoId: videoId || null,
        playlistId: playlistId || null,
        isLive: /\/live\//i.test(trimmed) || /live/i.test(trimmed),
      };
    }
  } catch {
    return null;
  }

  return null;
}
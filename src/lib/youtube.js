let ytApiPromise = null;

const YT_WEB_CLIENT_VERSION = '2.20241101.00.00';

/** True when the pasted URL is a YouTube /live/ link. */
export function isYoutubeLiveUrl(url) {
  return /youtube\.com\/live\//i.test(url?.trim() || '');
}

export function buildYoutubePlayerOptions({ videoId, playlistId, origin }) {
  if (!videoId && !playlistId) return null;

  const playerVars = {
    autoplay: 1,
    rel: 0,
    modestbranding: 1,
    playsinline: 1,
    enablejsapi: 1,
  };

  if (origin) {
    playerVars.origin = origin;
    playerVars.widget_referrer = origin;
  }

  if (videoId) {
    if (playlistId) playerVars.list = playlistId;
    return { videoId, playerVars };
  }

  playerVars.listType = 'playlist';
  playerVars.list = playlistId;
  return { playerVars };
}

/** @deprecated Use buildYoutubePlayerOptions — kept for embed URL generation if needed */
export function buildYoutubeEmbedUrl({ videoId, playlistId, origin }) {
  const options = buildYoutubePlayerOptions({ videoId, playlistId, origin });
  if (!options) return null;

  const params = new URLSearchParams(options.playerVars);

  if (options.videoId) {
    return `https://www.youtube.com/embed/${options.videoId}?${params.toString()}`;
  }

  return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
}

/** Load the YouTube IFrame API once (browser only). */
export function loadYoutubeIframeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);

  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    });
  }

  return ytApiPromise;
}

function getPlayerVideoId(player) {
  try {
    return player?.getVideoData?.()?.video_id || '';
  } catch {
    return '';
  }
}

/**
 * Detect live playback from the IFrame API.
 * Handles: true live (duration 0), DVR live (growing duration near live edge).
 */
export function isYoutubePlayerLive(player, durationSamples = []) {
  try {
    if (typeof player?.getDuration !== 'function') return false;

    const state = player.getPlayerState?.();
    const isActive = state === 1 || state === 3;
    if (!isActive) return false;

    const duration = player.getDuration();
    const current = player.getCurrentTime?.() ?? 0;

    if (duration === 0) return true;
    if (!Number.isFinite(duration)) return true;

    if (duration > 0) {
      const samples = [...durationSamples, { duration, current, at: Date.now() }]
        .filter((s) => Date.now() - s.at < 15000)
        .slice(-6);

      durationSamples.length = 0;
      durationSamples.push(...samples);

      const growing =
        samples.length >= 2 &&
        samples[samples.length - 1].duration > samples[0].duration + 0.5;

      const nearLiveEdge = duration - current >= 0 && duration - current <= 45;

      if (growing && nearLiveEdge) return true;
    }

    return false;
  } catch {
    return false;
  }
}

const livePlaylistCache = new Map();
const broadcastCache = new Map();

async function fetchYoutubeBroadcastViaProxy(videoId) {
  if (!videoId) return null;

  const cacheKey = `${videoId}:${Math.floor(Date.now() / 120000)}`;
  if (broadcastCache.has(cacheKey)) {
    return broadcastCache.get(cacheKey);
  }

  try {
    const params = new URLSearchParams({ videoId });
    const res = await fetch(`/api/youtube-live?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const result = {
      isLiveNow: !!data?.isLiveNow,
      isBroadcast: !!data?.isBroadcast,
    };
    broadcastCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/** Optional: YouTube Data API check when VITE_YOUTUBE_API_KEY is configured. */
export async function fetchYoutubeLiveViaDataApi(videoId) {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey || !videoId) return null;

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      id: videoId,
      key: apiKey,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
    if (!res.ok) return null;

    const data = await res.json();
    const status = data?.items?.[0]?.snippet?.liveBroadcastContent;
    if (status === 'live') return true;
    if (status === 'none' || status === 'completed') return false;
    return null;
  } catch {
    return null;
  }
}

/** Prefetch playlist live/broadcast video IDs (Data API or local proxy). */
export async function fetchPlaylistLiveStatus(playlistId) {
  const empty = { liveNow: new Set(), broadcasts: new Set() };
  if (!playlistId) return empty;

  const cacheKey = `${playlistId}:${Math.floor(Date.now() / 60000)}`;
  if (livePlaylistCache.has(cacheKey)) {
    return livePlaylistCache.get(cacheKey);
  }

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const itemsParams = new URLSearchParams({
        part: 'snippet',
        playlistId,
        maxResults: '50',
        key: apiKey,
      });
      const itemsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${itemsParams.toString()}`
      );
      if (!itemsRes.ok) return empty;

      const itemsData = await itemsRes.json();
      const videoIds =
        itemsData.items
          ?.map((item) => item.snippet?.resourceId?.videoId)
          .filter(Boolean) || [];

      if (!videoIds.length) return empty;

      const videosParams = new URLSearchParams({
        part: 'snippet,liveStreamingDetails',
        id: videoIds.join(','),
        key: apiKey,
      });
      const videosRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`
      );
      if (!videosRes.ok) return empty;

      const videosData = await videosRes.json();
      const liveNow = new Set();
      const broadcasts = new Set();
      for (const item of videosData.items || []) {
        if (item.snippet?.liveBroadcastContent === 'live') liveNow.add(item.id);
        if (item.liveStreamingDetails) broadcasts.add(item.id);
      }

      const result = { liveNow, broadcasts };
      livePlaylistCache.set(cacheKey, result);
      return result;
    } catch {
      return empty;
    }
  }

  try {
    const params = new URLSearchParams({ playlistId });
    const res = await fetch(`/api/youtube-live?${params.toString()}`);
    if (!res.ok) return empty;
    const data = await res.json();
    const result = {
      liveNow: new Set(data?.liveNow || []),
      broadcasts: new Set(data?.broadcasts || []),
    };
    livePlaylistCache.set(cacheKey, result);
    return result;
  } catch {
    return empty;
  }
}

/** @deprecated Use fetchPlaylistLiveStatus */
export async function fetchLiveVideoIdsInPlaylist(playlistId) {
  const status = await fetchPlaylistLiveStatus(playlistId);
  return status.liveNow;
}

export function isYoutubeSourceLive(source, player, durationSamples = []) {
  return (
    isYoutubeLiveUrl(source?.url) ||
    source?.isLive === true ||
    isYoutubePlayerLive(player, durationSamples)
  );
}

export async function resolveYoutubeLiveStatus(
  source,
  player,
  durationSamples = [],
  playlistLiveStatus = null
) {
  if (isYoutubeLiveUrl(source?.url) || source?.isLive === true) {
    return true;
  }

  const videoId = getPlayerVideoId(player);

  if (videoId && playlistLiveStatus?.liveNow?.has(videoId)) {
    return true;
  }

  if (isYoutubePlayerLive(player, durationSamples)) {
    return true;
  }

  if (videoId) {
    const apiResult = await fetchYoutubeLiveViaDataApi(videoId);
    if (apiResult === true) return true;

    const proxyResult = await fetchYoutubeBroadcastViaProxy(videoId);
    if (proxyResult?.isLiveNow) return true;

    // Match /live/VIDEO_ID behavior for ended live replays in playlists.
    if (proxyResult?.isBroadcast) return true;
    if (playlistLiveStatus?.broadcasts?.has(videoId)) return true;

    if (apiResult === false) return false;
  }

  return false;
}

export { getPlayerVideoId };
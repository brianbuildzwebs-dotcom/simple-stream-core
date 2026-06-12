const INNERTUBE_VERSION = '2.20241101.00.00';

function getApiKey(options = {}) {
  return options.apiKey || null;
}

export async function fetchInnertubePlayer(videoId, options = {}) {
  const apiKey = getApiKey(options);
  if (!apiKey) return null;

  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: INNERTUBE_VERSION } },
        videoId,
      }),
    }
  );
  if (!res.ok) return null;
  return res.json();
}

export function parseBroadcastStatus(data) {
  const details = data?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
  return {
    isLiveNow: !!details?.isLiveNow,
    isBroadcast: !!details?.startTimestamp,
    startTimestamp: details?.startTimestamp || null,
    endTimestamp: details?.endTimestamp || null,
  };
}

export async function fetchPlaylistVideoIds(playlistId) {
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`
  );
  if (!res.ok) return [];
  const text = await res.text();
  return [...text.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map((m) => m[1]);
}

export async function resolveVideoBroadcast(videoId, options = {}) {
  const data = await fetchInnertubePlayer(videoId, options);
  if (!data) return { isLiveNow: false, isBroadcast: false };
  return parseBroadcastStatus(data);
}

export async function resolvePlaylistBroadcasts(playlistId, limit = 10, options = {}) {
  const ids = (await fetchPlaylistVideoIds(playlistId)).slice(0, limit);
  const results = await Promise.all(
    ids.map(async (id) => ({ id, ...(await resolveVideoBroadcast(id, options)) }))
  );
  return results;
}
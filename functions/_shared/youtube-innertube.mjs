const INNERTUBE_VERSION = '2.20241101.00.00';
const INNERTUBE_KEY_TTL_MS = 60 * 60 * 1000;

let cachedApiKey = null;
let cachedAt = 0;

function extractInnertubeKey(html) {
  const patterns = [
    /"INNERTUBE_API_KEY":"([^"]+)"/,
    /INNERTUBE_API_KEY':'([^']+)'/,
    /INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function fetchPublicInnertubeKey() {
  const res = await fetch('https://www.youtube.com/embed/', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) return null;

  const html = await res.text();
  return extractInnertubeKey(html);
}

export async function resolveInnertubeApiKey(options = {}) {
  if (options.apiKey) return options.apiKey;

  const now = Date.now();
  if (cachedApiKey && now - cachedAt < INNERTUBE_KEY_TTL_MS) {
    return cachedApiKey;
  }

  const fetched = await fetchPublicInnertubeKey();
  if (fetched) {
    cachedApiKey = fetched;
    cachedAt = now;
  }

  return fetched;
}

export async function fetchInnertubePlayer(videoId, options = {}) {
  const apiKey = await resolveInnertubeApiKey(options);
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
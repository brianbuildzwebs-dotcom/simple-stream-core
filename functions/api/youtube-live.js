import {
  resolvePlaylistBroadcasts,
  resolveVideoBroadcast,
} from '../_shared/youtube-innertube.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const url = new URL(context.request.url);
  const videoId = url.searchParams.get('videoId');
  const playlistId = url.searchParams.get('playlistId');

  const innertubeOptions = { apiKey: context.env?.YOUTUBE_INNERTUBE_KEY };

  try {
    if (playlistId) {
      const items = await resolvePlaylistBroadcasts(playlistId, 10, innertubeOptions);
      const liveNow = items.filter((item) => item.isLiveNow).map((item) => item.id);
      const broadcasts = items.filter((item) => item.isBroadcast).map((item) => item.id);
      return Response.json({ liveNow, broadcasts, items }, { headers: CORS });
    }

    if (videoId) {
      const status = await resolveVideoBroadcast(videoId, innertubeOptions);
      return Response.json({ videoId, ...status }, { headers: CORS });
    }

    return Response.json({ error: 'videoId or playlistId required' }, { status: 400, headers: CORS });
  } catch {
    return Response.json({ error: 'upstream_failed' }, { status: 502, headers: CORS });
  }
}
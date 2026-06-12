import {
  resolvePlaylistBroadcasts,
  resolveVideoBroadcast,
} from '../functions/_shared/youtube-innertube.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/youtube-live') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405, headers: CORS });
      }

      const videoId = url.searchParams.get('videoId');
      const playlistId = url.searchParams.get('playlistId');

      try {
        if (playlistId) {
          const items = await resolvePlaylistBroadcasts(playlistId);
          const liveNow = items.filter((item) => item.isLiveNow).map((item) => item.id);
          const broadcasts = items.filter((item) => item.isBroadcast).map((item) => item.id);
          return Response.json({ liveNow, broadcasts, items }, { headers: CORS });
        }

        if (videoId) {
          const status = await resolveVideoBroadcast(videoId);
          return Response.json({ videoId, ...status }, { headers: CORS });
        }

        return Response.json(
          { error: 'videoId or playlistId required' },
          { status: 400, headers: CORS }
        );
      } catch {
        return Response.json({ error: 'upstream_failed' }, { status: 502, headers: CORS });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
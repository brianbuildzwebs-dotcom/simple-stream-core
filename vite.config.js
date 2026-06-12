import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import {
  resolvePlaylistBroadcasts,
  resolveVideoBroadcast,
} from './shared/youtube-innertube.mjs';

function youtubeLiveApiPlugin() {
  return {
    name: 'youtube-live-api',
    configureServer(server) {
      server.middlewares.use('/api/youtube-live', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end();
          return;
        }

        const url = new URL(req.url, 'http://localhost');
        const videoId = url.searchParams.get('videoId');
        const playlistId = url.searchParams.get('playlistId');

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
          if (playlistId) {
            const items = await resolvePlaylistBroadcasts(playlistId);
            const liveNow = items.filter((item) => item.isLiveNow).map((item) => item.id);
            const broadcasts = items.filter((item) => item.isBroadcast).map((item) => item.id);
            res.end(JSON.stringify({ liveNow, broadcasts, items }));
            return;
          }

          if (videoId) {
            const status = await resolveVideoBroadcast(videoId);
            res.end(JSON.stringify({ videoId, ...status }));
            return;
          }

          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'videoId or playlistId required' }));
        } catch {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'upstream_failed' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), youtubeLiveApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
  },
});

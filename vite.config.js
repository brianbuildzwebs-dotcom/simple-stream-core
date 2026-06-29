import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import {
  resolvePlaylistBroadcasts,
  resolveVideoBroadcast,
} from './functions/_shared/youtube-innertube.mjs';

function youtubeLiveApiPlugin(apiKey) {
  const innertubeOptions = apiKey ? { apiKey } : {};

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
            const items = await resolvePlaylistBroadcasts(playlistId, 10, innertubeOptions);
            const liveNow = items.filter((item) => item.isLiveNow).map((item) => item.id);
            const broadcasts = items.filter((item) => item.isBroadcast).map((item) => item.id);
            res.end(JSON.stringify({ liveNow, broadcasts, items }));
            return;
          }

          if (videoId) {
            const status = await resolveVideoBroadcast(videoId, innertubeOptions);
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN;

  const apiProxyTarget = (env.VITE_API_PROXY_TARGET || 'https://simplestreamz.io').replace(/\/$/, '');

  return {
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    plugins: [
      react(),
      youtubeLiveApiPlugin(env.YOUTUBE_INNERTUBE_KEY),
      sentryVitePlugin({
        org: process.env.SENTRY_ORG || env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT || env.SENTRY_PROJECT,
        authToken: sentryAuthToken,
        disable: !sentryAuthToken,
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: !!sentryAuthToken,
    },
  };
});
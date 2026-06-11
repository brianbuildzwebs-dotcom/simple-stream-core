export const RTMP_SERVER_URL =
  import.meta.env.VITE_RTMP_SERVER_URL ?? 'rtmps://live.cloudflare.com:443/live/';

export const RTMP_STREAM_KEY = import.meta.env.VITE_RTMP_STREAM_KEY ?? '';

export const RTMP_HLS_URL = import.meta.env.VITE_RTMP_HLS_URL ?? '';

export function buildRtmpSource(streamKey) {
  const key = streamKey?.trim();
  return {
    type: 'rtmp',
    streamKey: key,
    serverUrl: RTMP_SERVER_URL,
    hlsUrl: RTMP_HLS_URL || null,
  };
}

export function getObsInstructions(streamKey) {
  return {
    server: RTMP_SERVER_URL,
    key: streamKey || RTMP_STREAM_KEY || '(set VITE_RTMP_STREAM_KEY)',
  };
}
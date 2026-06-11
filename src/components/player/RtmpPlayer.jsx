import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Radio, Loader2, AlertCircle } from 'lucide-react';

const STATUS = {
  LOADING: 'loading',
  LIVE: 'live',
  WAITING: 'waiting',
  ERROR: 'error',
  NO_URL: 'no_url',
};

export default function RtmpPlayer({ source, videoRef, onPlay, onPause }) {
  const hlsRef = useRef(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    const hlsUrl = source?.hlsUrl;

    if (!video) return undefined;

    if (!hlsUrl) {
      setStatus(STATUS.NO_URL);
      return undefined;
    }

    setStatus(STATUS.LOADING);
    setErrorMsg('');

    const onVideoPlay = () => onPlay?.();
    const onVideoPause = () => onPause?.();

    video.addEventListener('play', onVideoPlay);
    video.addEventListener('pause', onVideoPause);

    const cleanup = () => {
      video.removeEventListener('play', onVideoPlay);
      video.removeEventListener('pause', onVideoPause);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        setStatus(STATUS.LIVE);
        video.play().catch(() => setStatus(STATUS.WAITING));
      });
      video.addEventListener('error', () => {
        setStatus(STATUS.WAITING);
        setErrorMsg('Stream not live yet. Start OBS and try again.');
      });
      return cleanup;
    }

    if (!Hls.isSupported()) {
      setStatus(STATUS.ERROR);
      setErrorMsg('HLS playback is not supported in this browser.');
      return cleanup;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
    });
    hlsRef.current = hls;

    hls.loadSource(hlsUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus(STATUS.LIVE);
      video.play().catch(() => setStatus(STATUS.WAITING));
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        setStatus(STATUS.WAITING);
        setErrorMsg('Waiting for stream… Start OBS, then we will reconnect.');
        hls.startLoad();
        return;
      }
      setStatus(STATUS.ERROR);
      setErrorMsg('Playback error. Check your HLS URL and stream.');
      hls.destroy();
      hlsRef.current = null;
    });

    return cleanup;
  }, [source?.hlsUrl, videoRef, onPlay, onPause]);

  if (status === STATUS.NO_URL) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-white p-6">
        <div className="text-center max-w-md">
          <Radio className="w-10 h-10 text-accent mx-auto mb-3" />
          <p className="text-lg font-medium">RTMP ingest ready</p>
          <p className="text-sm text-gray-400 mt-2">
            Add <code className="text-xs bg-white/10 px-1 rounded">VITE_RTMP_HLS_URL</code> to
            your <code className="text-xs bg-white/10 px-1 rounded">.env.local</code> to enable
            live playback.
          </p>
          <p className="text-xs text-gray-500 mt-4 font-mono break-all">
            Server: {source?.serverUrl}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-mono break-all">
            Key: {source?.streamKey}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        muted
      />
      {(status === STATUS.LOADING || status === STATUS.WAITING) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <div className="text-center text-white">
            {status === STATUS.LOADING ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
            ) : (
              <Radio className="w-8 h-8 mx-auto mb-2 text-accent animate-pulse" />
            )}
            <p className="text-sm font-medium">
              {status === STATUS.LOADING ? 'Connecting to stream…' : 'Waiting for live stream…'}
            </p>
            {errorMsg && <p className="text-xs text-white/70 mt-1 max-w-xs">{errorMsg}</p>}
          </div>
        </div>
      )}
      {status === STATUS.ERROR && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-none">
          <div className="text-center text-white">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm">{errorMsg}</p>
          </div>
        </div>
      )}
      {status === STATUS.LIVE && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white pointer-events-none">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      )}
    </>
  );
}
import React, { useLayoutEffect, useRef, useState, memo, useCallback } from 'react';
import Hls from 'hls.js';
import { Radio, Loader2, AlertCircle, Play } from 'lucide-react';
import LiveBadge from './LiveBadge';

const STATUS = {
  LOADING: 'loading',
  LIVE: 'live',
  WAITING: 'waiting',
  ERROR: 'error',
  NO_URL: 'no_url',
};

const WAITING_MSG = 'Waiting for live stream…';

function RtmpPlayer({
  hlsUrl,
  embed = false,
  viewerCount = 0,
  onPlayingChange,
  onVideoReady,
  videoRef: externalVideoRef,
}) {
  const internalVideoRef = useRef(null);
  const onVideoReadyRef = useRef(onVideoReady);
  onVideoReadyRef.current = onVideoReady;

  const setVideoRef = (node) => {
    internalVideoRef.current = node;
    if (externalVideoRef) externalVideoRef.current = node;
    if (node) onVideoReadyRef.current?.();
  };
  const hlsRef = useRef(null);
  const activeUrlRef = useRef('');
  const onPlayingChangeRef = useRef(onPlayingChange);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const deferUntilClick = embed && inIframe;

  const [status, setStatus] = useState(() => {
    if (!hlsUrl) return STATUS.NO_URL;
    if (deferUntilClick) return STATUS.WAITING;
    return STATUS.LOADING;
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [awaitingClick, setAwaitingClick] = useState(deferUntilClick);

  onPlayingChangeRef.current = onPlayingChange;

  const markLive = useCallback(() => {
    setAwaitingClick(false);
    setStatus(STATUS.LIVE);
    setErrorMsg('');
    onPlayingChangeRef.current?.(true);
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const attachHls = useCallback(
    (video, url) => {
      destroyHls();
      activeUrlRef.current = url;

      const tryPlay = () => {
        video
          .play()
          .then(markLive)
          .catch(() => {
            if (video.readyState >= 2) markLive();
            else {
              setStatus(STATUS.WAITING);
              setErrorMsg('Tap play again to start.');
              setAwaitingClick(true);
            }
          });
      };

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: false,
          liveDurationInfinity: true,
          backBufferLength: 90,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          liveSyncDuration: 4,
          liveMaxLatencyDuration: 12,
          manifestLoadingMaxRetry: 12,
          manifestLoadingRetryDelay: 1500,
          levelLoadingMaxRetry: 6,
          fragLoadingMaxRetry: 8,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (video.readyState >= 2 && !video.paused) markLive();
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          setStatus(STATUS.ERROR);
          setErrorMsg('Unable to play stream. Confirm the broadcast is live.');
          destroyHls();
        });
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', tryPlay, { once: true });
        video.addEventListener('error', () => {
          setStatus(STATUS.ERROR);
          setErrorMsg('Unable to load stream.');
        }, { once: true });
        return;
      }

      setStatus(STATUS.ERROR);
      setErrorMsg('HLS playback is not supported in this browser.');
    },
    [destroyHls, markLive]
  );

  useLayoutEffect(() => {
    const video = internalVideoRef.current;
    if (!video || !hlsUrl) {
      activeUrlRef.current = '';
      destroyHls();
      if (!hlsUrl) setStatus(STATUS.NO_URL);
      return undefined;
    }

    if (deferUntilClick) {
      return undefined;
    }

    if (activeUrlRef.current === hlsUrl && hlsRef.current) {
      return undefined;
    }

    setStatus(STATUS.LOADING);
    setErrorMsg('');
    attachHls(video, hlsUrl);

    const onPlaying = () => onPlayingChangeRef.current?.(true);
    const onPausing = () => onPlayingChangeRef.current?.(false);
    video.addEventListener('play', onPlaying);
    video.addEventListener('pause', onPausing);

    return () => {
      video.removeEventListener('play', onPlaying);
      video.removeEventListener('pause', onPausing);
      destroyHls();
      activeUrlRef.current = '';
    };
  }, [hlsUrl, deferUntilClick, attachHls, destroyHls]);

  const handleStartClick = () => {
    const video = internalVideoRef.current;
    if (!video || !hlsUrl) return;

    setAwaitingClick(false);
    setStatus(STATUS.LOADING);
    setErrorMsg('');
    attachHls(video, hlsUrl);
  };

  if (status === STATUS.NO_URL) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-white p-6">
        <div className="text-center max-w-md">
          <Radio className="w-10 h-10 text-accent mx-auto mb-3" />
          <p className="text-lg font-medium">Stream unavailable</p>
          <p className="text-sm text-gray-400 mt-2">
            Regenerate embed code from the main player while your stream is connected.
          </p>
        </div>
      </div>
    );
  }

  const showOverlay =
    awaitingClick || status === STATUS.LOADING || status === STATUS.WAITING;

  return (
    <div className="absolute inset-0">
      <video
        ref={setVideoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        muted
      />
      {showOverlay && status !== STATUS.ERROR && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
          <div className="text-center text-white px-4 max-w-sm">
            {awaitingClick ? (
              <>
                <button
                  type="button"
                  onClick={handleStartClick}
                  className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
                  aria-label="Play live stream"
                >
                  <Play className="w-7 h-7 ml-0.5" />
                </button>
                <p className="text-sm font-medium">Play live stream</p>
              </>
            ) : (
              <>
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{WAITING_MSG}</p>
              </>
            )}
          </div>
        </div>
      )}
      {status === STATUS.ERROR && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center text-white px-4">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm">{errorMsg}</p>
            <button
              type="button"
              onClick={handleStartClick}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          </div>
        </div>
      )}
      {status === STATUS.LIVE && <LiveBadge viewerCount={viewerCount} />}
    </div>
  );
}

export default memo(RtmpPlayer);
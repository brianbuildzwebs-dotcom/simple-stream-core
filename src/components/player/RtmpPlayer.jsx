import React, { useEffect, useLayoutEffect, useRef, useState, memo, useCallback } from 'react';
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

function readHlsLiveFlag(hls) {
  const level = hls.levels?.[hls.currentLevel] ?? hls.levels?.[0];
  return level?.details?.live === true;
}

function readNativeHlsLive(video) {
  return !Number.isFinite(video.duration) || video.duration === Infinity;
}

function RtmpPlayer({
  hlsUrl,
  embed = false,
  viewerCount = 0,
  onPlayingChange,
  onLiveChange,
  onVideoReady,
  onUserStartRequiredChange,
  onRegisterStartPlayback,
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
  const onLiveChangeRef = useRef(onLiveChange);
  const playbackUnlockedRef = useRef(false);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const deferUntilClick = embed && inIframe;

  const [isStreamLive, setIsStreamLive] = useState(false);
  const [status, setStatus] = useState(() => {
    if (!hlsUrl) return STATUS.NO_URL;
    if (deferUntilClick) return STATUS.WAITING;
    return STATUS.LOADING;
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [awaitingClick, setAwaitingClick] = useState(deferUntilClick);

  onPlayingChangeRef.current = onPlayingChange;
  onLiveChangeRef.current = onLiveChange;

  const updateStreamLive = useCallback((live) => {
    setIsStreamLive(live);
    onLiveChangeRef.current?.(live);
  }, []);

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

  const unlockPlayback = useCallback((video) => {
    if (!video) return;
    playbackUnlockedRef.current = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', 'true');
    const attempt = video.play();
    if (attempt?.catch) {
      attempt.catch(() => {});
    }
  }, []);

  const tryStartPlayback = useCallback(
    (video) => {
      if (!video) return;

      if (!video.paused) {
        markLive();
        return;
      }

      video
        .play()
        .then(markLive)
        .catch(() => {
          if (video.readyState >= 2) {
            markLive();
            return;
          }
          setStatus(STATUS.WAITING);
          setErrorMsg('Tap play again to start.');
          setAwaitingClick(true);
          playbackUnlockedRef.current = false;
        });
    },
    [markLive]
  );

  const attachHls = useCallback(
    (video, url, { autoPlay = true } = {}) => {
      destroyHls();
      activeUrlRef.current = url;

      const tryPlay = () => {
        if (!autoPlay && deferUntilClick) {
          setStatus(STATUS.WAITING);
          return;
        }
        tryStartPlayback(video);
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
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          updateStreamLive(readHlsLiveFlag(hls));
          tryPlay();
        });
        hls.on(Hls.Events.LEVEL_UPDATED, (_event, { details }) => {
          if (typeof details?.live === 'boolean') {
            updateStreamLive(details.live);
          }
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (video.readyState >= 2 && !video.paused) {
            markLive();
            return;
          }
          if (playbackUnlockedRef.current && video.paused) {
            tryStartPlayback(video);
          }
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
        video.addEventListener(
          'loadedmetadata',
          () => {
            updateStreamLive(readNativeHlsLive(video));
            tryPlay();
          },
          { once: true }
        );
        video.addEventListener('durationchange', () => {
          updateStreamLive(readNativeHlsLive(video));
        });
        video.addEventListener('error', () => {
          setStatus(STATUS.ERROR);
          setErrorMsg('Unable to load stream.');
        }, { once: true });
        return;
      }

      setStatus(STATUS.ERROR);
      setErrorMsg('HLS playback is not supported in this browser.');
    },
    [deferUntilClick, destroyHls, tryStartPlayback, updateStreamLive]
  );

  useLayoutEffect(() => {
    const video = internalVideoRef.current;
    if (!video || !hlsUrl) {
      activeUrlRef.current = '';
      destroyHls();
      updateStreamLive(false);
      playbackUnlockedRef.current = false;
      if (!hlsUrl) setStatus(STATUS.NO_URL);
      return undefined;
    }

    if (activeUrlRef.current === hlsUrl && hlsRef.current) {
      return undefined;
    }

    if (deferUntilClick) {
      setAwaitingClick(true);
      playbackUnlockedRef.current = false;
    }

    setStatus(STATUS.LOADING);
    setErrorMsg('');
    attachHls(video, hlsUrl, { autoPlay: !deferUntilClick });

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
  }, [hlsUrl, deferUntilClick, attachHls, destroyHls, updateStreamLive]);

  const handleStartClick = useCallback(() => {
    const video = internalVideoRef.current;
    if (!video || !hlsUrl) return;

    setAwaitingClick(false);
    setStatus(STATUS.LOADING);
    setErrorMsg('');
    unlockPlayback(video);

    if (!hlsRef.current || activeUrlRef.current !== hlsUrl) {
      attachHls(video, hlsUrl, { autoPlay: true });
      return;
    }

    tryStartPlayback(video);
  }, [attachHls, hlsUrl, tryStartPlayback, unlockPlayback]);

  useEffect(() => {
    onUserStartRequiredChange?.(deferUntilClick && awaitingClick);
  }, [awaitingClick, deferUntilClick, onUserStartRequiredChange]);

  useEffect(() => {
    onRegisterStartPlayback?.(handleStartClick);
    return () => onRegisterStartPlayback?.(null);
  }, [handleStartClick, onRegisterStartPlayback]);

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

  const showTapToPlay = deferUntilClick && awaitingClick;
  const showLoadingOverlay =
    !showTapToPlay && status !== STATUS.ERROR && (status === STATUS.LOADING || status === STATUS.WAITING);

  return (
    <div className="absolute inset-0">
      <video
        ref={setVideoRef}
        className="absolute inset-0 w-full h-full object-contain bg-black"
        playsInline
        muted
        preload="auto"
      />
      {showTapToPlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <button
            type="button"
            onClick={handleStartClick}
            className="flex max-w-xs flex-col items-center px-6 py-4 text-center text-white touch-manipulation"
            aria-label="Play live stream"
          >
            <span className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95">
              <Play className="ml-0.5 h-8 w-8" />
            </span>
            <span className="text-sm font-medium">Tap to play live stream</span>
            {status === STATUS.LOADING && (
              <span className="mt-2 text-xs text-white/60">Connecting…</span>
            )}
          </button>
        </div>
      )}
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <div className="px-4 text-center text-white">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{WAITING_MSG}</p>
          </div>
        </div>
      )}
      {status === STATUS.ERROR && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80">
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
      {status === STATUS.LIVE && isStreamLive && (
        <LiveBadge viewerCount={viewerCount} />
      )}
    </div>
  );
}

export default memo(RtmpPlayer);
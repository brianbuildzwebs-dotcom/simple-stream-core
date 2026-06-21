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

const WAITING_FOR_FEED_TITLE = 'Waiting for live feed';
const WAITING_FOR_FEED_BODY =
  "The stream hasn't started yet. Chat with others while you wait — video will begin automatically when we go live.";
const TAP_TO_JOIN_TITLE = 'Tap to join live stream';
const TAP_TO_JOIN_BODY =
  'Video starts automatically when the feed goes live. Feel free to open chat while you wait.';
const REPLAY_BADGE_LABEL = 'Service replay';
const FEED_POLL_MS = 5000;
const CONNECTING_TIMEOUT_MS = 8000;

function readHlsLiveFlag(hls) {
  const level = hls.levels?.[hls.currentLevel] ?? hls.levels?.[0];
  return level?.details?.live === true;
}

function readNativeHlsLive(video) {
  return !Number.isFinite(video.duration) || video.duration === Infinity;
}

function RtmpPlayer({
  hlsUrl,
  replayHlsUrl = null,
  playbackMode = 'holding',
  replayWhenOffline = false,
  holdingTitle = null,
  holdingMessage = null,
  embed = false,
  viewerCount = 0,
  videoFit = 'contain',
  defaultVolume,
  onAudiblePlayback,
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
  const isStreamLiveRef = useRef(false);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onLiveChangeRef = useRef(onLiveChange);
  const playbackUnlockedRef = useRef(false);
  const audibleVolumeAppliedRef = useRef(false);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const deferUntilClick = embed && inIframe;

  const [playMode, setPlayMode] = useState(() => {
    if (playbackMode === 'replay' && replayHlsUrl) return 'replay';
    if (playbackMode === 'live') return 'live';
    return 'holding';
  });
  const [isStreamLive, setIsStreamLive] = useState(false);
  const activeUrl =
    playMode === 'replay' && replayHlsUrl ? replayHlsUrl : hlsUrl;
  const isReplay = playMode === 'replay' && !!replayHlsUrl;
  const waitingTitle = holdingTitle?.trim() || WAITING_FOR_FEED_TITLE;
  const waitingBody = holdingMessage?.trim() || WAITING_FOR_FEED_BODY;
  const tapTitle = holdingTitle?.trim() || TAP_TO_JOIN_TITLE;
  const tapBody = holdingMessage?.trim() || TAP_TO_JOIN_BODY;
  const [status, setStatus] = useState(() => {
    if (!activeUrl) return STATUS.NO_URL;
    if (deferUntilClick) return STATUS.WAITING;
    if (isReplay) return STATUS.LOADING;
    return STATUS.LOADING;
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [awaitingClick, setAwaitingClick] = useState(deferUntilClick);
  const [viewerReady, setViewerReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const connectingTimerRef = useRef(null);

  onPlayingChangeRef.current = onPlayingChange;
  onLiveChangeRef.current = onLiveChange;

  const updateStreamLive = useCallback((live) => {
    isStreamLiveRef.current = live;
    setIsStreamLive(live);
    onLiveChangeRef.current?.(live);
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const applyAudibleVolume = useCallback(
    (video) => {
      if (!video || defaultVolume == null || audibleVolumeAppliedRef.current) return;
      audibleVolumeAppliedRef.current = true;
      video.volume = defaultVolume;
      video.muted = false;
      onAudiblePlayback?.();
    },
    [defaultVolume, onAudiblePlayback]
  );

  const markWaitingForFeed = useCallback(() => {
    setAwaitingClick(false);
    setStatus(STATUS.WAITING);
    setErrorMsg('');
  }, []);

  const clearConnectingTimer = useCallback(() => {
    if (connectingTimerRef.current) {
      window.clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
  }, []);

  const switchToReplay = useCallback(() => {
    if (!replayWhenOffline || !replayHlsUrl) return;
    setPlayMode('replay');
    setAwaitingClick(false);
    setStatus(STATUS.LOADING);
    setErrorMsg('');
    updateStreamLive(false);
  }, [replayHlsUrl, replayWhenOffline, updateStreamLive]);

  const markLive = useCallback(() => {
    const video = internalVideoRef.current;
    if (!video || video.paused) return;
    clearConnectingTimer();
    setAwaitingClick(false);
    setPlayMode('live');
    setStatus(STATUS.LIVE);
    setErrorMsg('');
    setIsVideoPlaying(true);
    onPlayingChangeRef.current?.(true);
    applyAudibleVolume(video);
  }, [applyAudibleVolume, clearConnectingTimer]);

  const markReplayPlaying = useCallback(() => {
    const video = internalVideoRef.current;
    if (!video || video.paused) return;
    clearConnectingTimer();
    setAwaitingClick(false);
    setStatus(STATUS.LIVE);
    setErrorMsg('');
    setIsVideoPlaying(true);
    onPlayingChangeRef.current?.(true);
    updateStreamLive(false);
    applyAudibleVolume(video);
  }, [applyAudibleVolume, clearConnectingTimer, updateStreamLive]);

  const scheduleConnectingTimeout = useCallback(() => {
    clearConnectingTimer();
    connectingTimerRef.current = window.setTimeout(() => {
      connectingTimerRef.current = null;
      if (!playbackUnlockedRef.current) return;
      const video = internalVideoRef.current;
      if (video && !video.paused && video.readyState >= 2) return;
      markWaitingForFeed();
    }, CONNECTING_TIMEOUT_MS);
  }, [clearConnectingTimer, markWaitingForFeed]);

  const unlockPlayback = useCallback(
    (video) => {
      if (!video) return;
      playbackUnlockedRef.current = true;
      setViewerReady(true);
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', 'true');
      if (defaultVolume != null) {
        video.volume = defaultVolume;
        video.muted = false;
      } else {
        video.muted = true;
      }
      const attempt = video.play();
      if (attempt?.then) {
        attempt.then(() => applyAudibleVolume(video)).catch(() => {});
      }
    },
    [applyAudibleVolume, defaultVolume]
  );

  const tryStartPlayback = useCallback(
    (video) => {
      if (!video) return;

      if (!video.paused && video.readyState >= 2) {
        markLive();
        return;
      }

      video
        .play()
        .then(() => {
          if (!video.paused && video.readyState >= 2) {
            markLive();
            return;
          }
          if (playbackUnlockedRef.current) {
            markWaitingForFeed();
          }
        })
        .catch(() => {
          if (video.readyState >= 2) {
            markLive();
            return;
          }
          if (playbackUnlockedRef.current) {
            markWaitingForFeed();
            return;
          }
          setStatus(STATUS.WAITING);
          setErrorMsg('Tap play again to start.');
          setAwaitingClick(true);
          playbackUnlockedRef.current = false;
        });
    },
    [markLive, markWaitingForFeed]
  );

  const attachHls = useCallback(
    (video, url, { autoPlay = true, vod = false } = {}) => {
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
        const hls = new Hls(
          vod
            ? {
                enableWorker: false,
                maxBufferLength: 30,
              }
            : {
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
              }
        );
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (vod) {
            updateStreamLive(false);
            tryPlay();
            return;
          }
          const live = readHlsLiveFlag(hls);
          updateStreamLive(live);
          tryPlay();
          if (playbackUnlockedRef.current && video.paused && !live) {
            markWaitingForFeed();
          }
        });
        hls.on(Hls.Events.LEVEL_UPDATED, (_event, { details }) => {
          if (vod) return;
          if (typeof details?.live === 'boolean') {
            const wasLive = isStreamLiveRef.current;
            updateStreamLive(details.live);
            if (details.live && playbackUnlockedRef.current && video.paused) {
              hls.startLoad(-1);
              tryStartPlayback(video);
              return;
            }
            if (details.live) {
              setPlayMode('live');
            }
            if (!details.live && wasLive && replayWhenOffline && replayHlsUrl) {
              switchToReplay();
              return;
            }
            if (!details.live && playbackUnlockedRef.current && video.paused) {
              markWaitingForFeed();
            }
          }
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (video.readyState >= 2 && !video.paused) {
            if (vod) {
              markReplayPlaying();
              return;
            }
            markLive();
            return;
          }
          if (playbackUnlockedRef.current) {
            tryStartPlayback(video);
          }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (playbackUnlockedRef.current) {
            if (
              data.type === Hls.ErrorTypes.NETWORK_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT
            ) {
              markWaitingForFeed();
            }
          }
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
          setErrorMsg('Unable to play stream. Confirm vMix/OBS is live, then try again in 30 seconds.');
          destroyHls();
        });
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener(
          'loadedmetadata',
          () => {
            if (vod) {
              updateStreamLive(false);
              tryPlay();
              return;
            }
            const live = readNativeHlsLive(video);
            updateStreamLive(live);
            tryPlay();
            if (playbackUnlockedRef.current && video.paused && !live) {
              markWaitingForFeed();
            }
          },
          { once: true }
        );
        video.addEventListener('durationchange', () => {
          if (vod) return;
          const live = readNativeHlsLive(video);
          const wasLive = isStreamLiveRef.current;
          updateStreamLive(live);
          if (live && playbackUnlockedRef.current && video.paused) {
            tryStartPlayback(video);
            return;
          }
          if (live) {
            setPlayMode('live');
          }
          if (!live && wasLive && replayWhenOffline && replayHlsUrl) {
            switchToReplay();
            return;
          }
          if (!live && playbackUnlockedRef.current && video.paused) {
            markWaitingForFeed();
          }
        });
        video.addEventListener('error', () => {
          if (playbackUnlockedRef.current) {
            markWaitingForFeed();
            return;
          }
          setStatus(STATUS.ERROR);
          setErrorMsg('Unable to load stream.');
        }, { once: true });
        return;
      }

      setStatus(STATUS.ERROR);
      setErrorMsg('HLS playback is not supported in this browser.');
    },
    [
      deferUntilClick,
      destroyHls,
      markLive,
      markReplayPlaying,
      markWaitingForFeed,
      replayHlsUrl,
      replayWhenOffline,
      switchToReplay,
      tryStartPlayback,
      updateStreamLive,
    ]
  );

  const reloadFeed = useCallback(
    (video) => {
      if (!video || !activeUrl) return;

      const cacheBustedUrl = activeUrl.includes('?')
        ? `${activeUrl}&_ssz=${Date.now()}`
        : `${activeUrl}?_ssz=${Date.now()}`;

      if (hlsRef.current) {
        hlsRef.current.loadSource(cacheBustedUrl);
        hlsRef.current.startLoad(-1);
        return;
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = cacheBustedUrl;
        video.load();
        return;
      }

      attachHls(video, activeUrl, { autoPlay: true, vod: isReplay });
    },
    [activeUrl, attachHls, isReplay]
  );

  useEffect(() => {
    if (playbackMode === 'replay' && replayHlsUrl) {
      setPlayMode('replay');
      return;
    }
    if (playbackMode === 'live') {
      setPlayMode('live');
      return;
    }
    setPlayMode((current) => (current === 'replay' ? current : 'holding'));
  }, [playbackMode, replayHlsUrl]);

  useLayoutEffect(() => {
    const video = internalVideoRef.current;
    if (!video || !activeUrl) {
      activeUrlRef.current = '';
      destroyHls();
      updateStreamLive(false);
      playbackUnlockedRef.current = false;
      setViewerReady(false);
      setIsVideoPlaying(false);
      clearConnectingTimer();
      if (!activeUrl) setStatus(STATUS.NO_URL);
      return undefined;
    }

    if (activeUrlRef.current === activeUrl && hlsRef.current) {
      return undefined;
    }

    audibleVolumeAppliedRef.current = false;

    if (deferUntilClick && !isReplay) {
      setAwaitingClick(true);
      playbackUnlockedRef.current = false;
      setViewerReady(false);
      setIsVideoPlaying(false);
    } else if (deferUntilClick && isReplay) {
      setAwaitingClick(true);
      playbackUnlockedRef.current = false;
      setViewerReady(false);
      setIsVideoPlaying(false);
    }

    setStatus(STATUS.LOADING);
    setErrorMsg('');
    attachHls(video, activeUrl, { autoPlay: !deferUntilClick, vod: isReplay });

    const onPlaying = () => {
      setIsVideoPlaying(true);
      onPlayingChangeRef.current?.(true);
      if (playbackUnlockedRef.current) {
        if (isReplay) {
          markReplayPlaying();
        } else {
          markLive();
        }
      }
    };
    const onPausing = () => {
      setIsVideoPlaying(false);
      onPlayingChangeRef.current?.(false);
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPausing);

    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPausing);
      clearConnectingTimer();
      destroyHls();
      activeUrlRef.current = '';
    };
  }, [
    activeUrl,
    deferUntilClick,
    attachHls,
    destroyHls,
    isReplay,
    updateStreamLive,
    markLive,
    markReplayPlaying,
    markWaitingForFeed,
    clearConnectingTimer,
  ]);

  const handleStartClick = useCallback(() => {
    const video = internalVideoRef.current;
    if (!video || !activeUrl) return;

    setAwaitingClick(false);
    setStatus(STATUS.LOADING);
    setErrorMsg('');
    unlockPlayback(video);
    if (!isReplay) {
      scheduleConnectingTimeout();
    }

    if (!hlsRef.current || activeUrlRef.current !== activeUrl) {
      attachHls(video, activeUrl, { autoPlay: true, vod: isReplay });
      return;
    }

    reloadFeed(video);
    tryStartPlayback(video);
  }, [
    activeUrl,
    attachHls,
    isReplay,
    reloadFeed,
    scheduleConnectingTimeout,
    tryStartPlayback,
    unlockPlayback,
  ]);

  useEffect(() => {
    if (!viewerReady || !hlsUrl || isReplay) return undefined;

    const pollForLiveFeed = () => {
      const video = internalVideoRef.current;
      if (!video || !playbackUnlockedRef.current) return;
      if (!video.paused && video.readyState >= 2) return;

      markWaitingForFeed();
      reloadFeed(video);
      tryStartPlayback(video);
    };

    const kickoff = window.setTimeout(pollForLiveFeed, 1200);
    const interval = window.setInterval(pollForLiveFeed, FEED_POLL_MS);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(interval);
    };
  }, [viewerReady, hlsUrl, isReplay, markWaitingForFeed, reloadFeed, tryStartPlayback]);

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
  const showWaitingOverlay =
    !isReplay &&
    viewerReady &&
    !showTapToPlay &&
    status !== STATUS.ERROR &&
    !isVideoPlaying;
  const showLoadingOverlay =
    viewerReady && !showTapToPlay && !showWaitingOverlay && status === STATUS.LOADING;

  return (
    <div className="absolute inset-0">
      <video
        ref={setVideoRef}
        className={`absolute inset-0 w-full h-full bg-black ${videoFit === 'cover' ? 'object-cover' : 'object-contain'}`}
        playsInline
        muted
        preload="auto"
      />
      {showTapToPlay && (
        <div className="rtmp-tap-overlay absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <button
            type="button"
            onClick={handleStartClick}
            className="flex w-full max-w-[17.5rem] flex-col items-center px-4 py-4 text-center text-white touch-manipulation"
            aria-label="Play live stream"
          >
            <span className="embed-tap-play-btn mb-3 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95">
              <Play className="ml-0.5" />
            </span>
            <span className="embed-tap-play-title font-medium">{isReplay ? 'Tap to watch replay' : tapTitle}</span>
            <span className="embed-tap-play-subtitle mt-2 text-white/65">
              {isReplay ? 'Watch the most recent service recording.' : tapBody}
            </span>
          </button>
        </div>
      )}
      {showWaitingOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6">
          <div className="max-w-sm text-center text-white">
            <Radio className="mx-auto mb-3 h-9 w-9 text-primary" />
            <p className="text-base font-semibold">{waitingTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{waitingBody}</p>
            <p className="mt-3 text-xs text-white/45">Checking for live feed every few seconds…</p>
          </div>
        </div>
      )}
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <div className="px-4 text-center text-white">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Connecting…</p>
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
      {status === STATUS.LIVE && isReplay && isVideoPlaying && (
        <div className="absolute left-3 top-3 z-30 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {REPLAY_BADGE_LABEL}
        </div>
      )}
    </div>
  );
}

export default memo(RtmpPlayer);
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LiveBadge from './LiveBadge';
import {
  buildYoutubePlayerOptions,
  fetchPlaylistLiveStatus,
  getPlayerVideoId,
  loadYoutubeIframeApi,
  resolveYoutubeLiveStatus,
} from '@/lib/youtube';

const MIN_PLAYER_SIZE = 120;

export default function YoutubePlayer({
  source,
  viewerCount = 0,
  onLiveChange,
  onPlayingChange,
  onPlayerInstance,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const durationSamplesRef = useRef([]);
  const playlistLiveStatusRef = useRef(null);
  const lastVideoIdRef = useRef('');
  const pollRef = useRef(null);
  const liveRequestRef = useRef(0);

  const [isLive, setIsLive] = useState(false);

  const onLiveChangeRef = useRef(onLiveChange);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onPlayerInstanceRef = useRef(onPlayerInstance);
  onLiveChangeRef.current = onLiveChange;
  onPlayingChangeRef.current = onPlayingChange;
  onPlayerInstanceRef.current = onPlayerInstance;

  const playerId = useMemo(
    () => `youtube-player-${source.videoId || source.playlistId || 'embed'}`,
    [source.videoId, source.playlistId]
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const playerOptions = useMemo(
    () => buildYoutubePlayerOptions({ videoId: source.videoId, playlistId: source.playlistId, origin }),
    [source.videoId, source.playlistId, origin]
  );

  const sourceKey = useMemo(
    () => `${playerId}:${source.videoId || ''}:${source.playlistId || ''}`,
    [playerId, source.videoId, source.playlistId]
  );

  useEffect(() => {
    setIsLive(false);
    onLiveChangeRef.current?.(false);
  }, [source.videoId, source.playlistId, source.url]);

  const resizePlayer = useCallback((width, height) => {
    if (!playerRef.current || width < MIN_PLAYER_SIZE || height < MIN_PLAYER_SIZE) return;
    try {
      playerRef.current.setSize(width, height);
    } catch {
      // Player may still be initializing.
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let rafId = 0;
    const measure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const width = Math.floor(container.clientWidth);
        const height = Math.floor(container.clientHeight);
        resizePlayer(width, height);
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    const onOrientation = () => window.setTimeout(measure, 150);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', onOrientation);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, [resizePlayer]);

  useEffect(() => {
    if (!source.playlistId) {
      playlistLiveStatusRef.current = null;
      return undefined;
    }

    let active = true;
    fetchPlaylistLiveStatus(source.playlistId).then((status) => {
      if (!active) return;
      playlistLiveStatusRef.current = status;
      if (playerRef.current) {
        const videoId = getPlayerVideoId(playerRef.current);
        if (videoId && status.liveNow.has(videoId)) {
          setIsLive(true);
          onLiveChangeRef.current?.(true);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [source.playlistId]);

  const mountedSourceKeyRef = useRef('');
  const isMountingRef = useRef(false);

  useEffect(() => {
    if (!playerOptions) return undefined;

    let cancelled = false;
    const liveCheckTimers = [];

    const applyLive = (live) => {
      if (cancelled) return;
      setIsLive(live);
      onLiveChangeRef.current?.(live);
    };

    const updateLive = async (player) => {
      if (cancelled || !player) return;

      const videoId = getPlayerVideoId(player);
      if (videoId && videoId !== lastVideoIdRef.current) {
        lastVideoIdRef.current = videoId;
        durationSamplesRef.current = [];
      }

      const requestId = ++liveRequestRef.current;
      const live = await resolveYoutubeLiveStatus(
        source,
        player,
        durationSamplesRef.current,
        playlistLiveStatusRef.current
      );
      if (!cancelled && requestId === liveRequestRef.current) {
        applyLive(live);
      }
    };

    const scheduleLiveChecks = (player) => {
      updateLive(player);
      [400, 1200, 3000, 6000, 10000, 15000, 20000].forEach((ms) => {
        const id = setTimeout(() => updateLive(player), ms);
        liveCheckTimers.push(id);
      });
    };

    const startPolling = (player) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => updateLive(player), 8000);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const mountPlayer = (width, height) => {
      const container = containerRef.current;
      if (
        !container
        || width < MIN_PLAYER_SIZE
        || height < MIN_PLAYER_SIZE
        || isMountingRef.current
        || playerRef.current
      ) {
        return;
      }

      isMountingRef.current = true;

      loadYoutubeIframeApi().then((YT) => {
        isMountingRef.current = false;
        if (cancelled || !YT || !containerRef.current) return;
        if (mountedSourceKeyRef.current === sourceKey && playerRef.current) return;

        playerRef.current?.destroy?.();
        lastVideoIdRef.current = '';
        durationSamplesRef.current = [];
        container.innerHTML = '';

        const target = document.createElement('div');
        target.id = playerId;
        target.className = 'h-full w-full';
        container.appendChild(target);

        const ytConfig = {
          width,
          height,
          playerVars: playerOptions.playerVars,
          events: {
            onReady: (event) => {
              if (cancelled) return;
              onPlayerInstanceRef.current?.(event.target);
              resizePlayer(
                Math.floor(containerRef.current?.clientWidth || width),
                Math.floor(containerRef.current?.clientHeight || height)
              );
              scheduleLiveChecks(event.target);
              startPolling(event.target);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const playing = event.data === YT.PlayerState.PLAYING;
              onPlayingChangeRef.current?.(playing);
              updateLive(event.target);
              if (playing) startPolling(event.target);
              if (event.data === YT.PlayerState.ENDED || event.data === YT.PlayerState.PAUSED) {
                stopPolling();
              }
            },
          },
        };

        if (playerOptions.videoId) {
          ytConfig.videoId = playerOptions.videoId;
        }

        playerRef.current = new YT.Player(playerId, ytConfig);
        mountedSourceKeyRef.current = sourceKey;
      });
    };

    const attemptMount = () => {
      const container = containerRef.current;
      if (!container || cancelled || playerRef.current || isMountingRef.current) return;
      const width = Math.floor(container.clientWidth);
      const height = Math.floor(container.clientHeight);
      if (width < MIN_PLAYER_SIZE || height < MIN_PLAYER_SIZE) return;
      mountPlayer(width, height);
    };

    mountedSourceKeyRef.current = '';
    attemptMount();

    const container = containerRef.current;
    const mountObserver = container
      ? new ResizeObserver(() => attemptMount())
      : null;
    mountObserver?.observe(container);

    return () => {
      cancelled = true;
      isMountingRef.current = false;
      mountObserver?.disconnect();
      liveRequestRef.current += 1;
      liveCheckTimers.forEach(clearTimeout);
      stopPolling();
      playerRef.current?.destroy?.();
      playerRef.current = null;
      mountedSourceKeyRef.current = '';
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [playerId, playerOptions, sourceKey, resizePlayer]);

  if (!playerOptions) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
      {isLive && <LiveBadge viewerCount={viewerCount} />}
    </div>
  );
}
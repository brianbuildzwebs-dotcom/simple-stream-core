import React, { useEffect, useMemo, useRef, useState } from 'react';
import LiveBadge from './LiveBadge';
import {
  buildYoutubePlayerOptions,
  fetchPlaylistLiveStatus,
  getPlayerVideoId,
  isYoutubeLiveUrl,
  loadYoutubeIframeApi,
  resolveYoutubeLiveStatus,
} from '@/lib/youtube';

const MIN_PLAYER_SIZE = 120;

export default function YoutubePlayer({
  source,
  viewerCount = 0,
  onLiveChange,
  onPlayingChange,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const durationSamplesRef = useRef([]);
  const playlistLiveStatusRef = useRef(null);
  const lastVideoIdRef = useRef('');
  const pollRef = useRef(null);
  const liveRequestRef = useRef(0);

  const [isLive, setIsLive] = useState(() => source.isLive || isYoutubeLiveUrl(source.url));
  const [playerSize, setPlayerSize] = useState(null);

  const playerId = useMemo(
    () => `youtube-player-${source.videoId || source.playlistId || 'embed'}`,
    [source.videoId, source.playlistId]
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const playerOptions = useMemo(
    () => buildYoutubePlayerOptions({ videoId: source.videoId, playlistId: source.playlistId, origin }),
    [source.videoId, source.playlistId, origin]
  );

  useEffect(() => {
    const fromUrl = source.isLive || isYoutubeLiveUrl(source.url);
    setIsLive(fromUrl);
    onLiveChange?.(fromUrl);
  }, [source.isLive, source.url, onLiveChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const width = Math.floor(container.clientWidth);
      const height = Math.floor(container.clientHeight);
      if (width >= MIN_PLAYER_SIZE && height >= MIN_PLAYER_SIZE) {
        setPlayerSize((prev) =>
          prev?.width === width && prev?.height === height ? prev : { width, height }
        );
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
        if (
          videoId &&
          (status.liveNow.has(videoId) || status.broadcasts.has(videoId))
        ) {
          setIsLive(true);
          onLiveChange?.(true);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [source.playlistId, onLiveChange]);

  useEffect(() => {
    if (!playerOptions || !playerSize) return undefined;

    let cancelled = false;
    const liveCheckTimers = [];

    const urlIsLive = source.isLive || isYoutubeLiveUrl(source.url);

    const applyLive = (live) => {
      if (cancelled) return;
      const nextLive = urlIsLive || live;
      setIsLive(nextLive);
      onLiveChange?.(nextLive);
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

    const mountPlayer = () => {
      const container = containerRef.current;
      if (!container) return;

      loadYoutubeIframeApi().then((YT) => {
        if (cancelled || !YT || !containerRef.current) return;

        playerRef.current?.destroy?.();
        lastVideoIdRef.current = '';
        durationSamplesRef.current = [];
        container.innerHTML = '';

        const target = document.createElement('div');
        target.id = playerId;
        target.className = 'h-full w-full';
        container.appendChild(target);

        const ytConfig = {
          width: playerSize.width,
          height: playerSize.height,
          playerVars: playerOptions.playerVars,
          events: {
            onReady: (event) => {
              if (cancelled) return;
              scheduleLiveChecks(event.target);
              startPolling(event.target);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const playing = event.data === YT.PlayerState.PLAYING;
              onPlayingChange?.(playing);
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
      });
    };

    mountPlayer();

    return () => {
      cancelled = true;
      liveRequestRef.current += 1;
      liveCheckTimers.forEach(clearTimeout);
      stopPolling();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [
    playerId,
    playerOptions,
    playerSize,
    source.videoId,
    source.playlistId,
    source.url,
    source.isLive,
    onLiveChange,
    onPlayingChange,
  ]);

  if (!playerOptions) return null;

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      {isLive && <LiveBadge viewerCount={viewerCount} />}
    </div>
  );
}
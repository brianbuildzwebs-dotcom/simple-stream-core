import React, { useRef, useState, useEffect, useCallback } from 'react';
import VideoControls from './VideoControls';
import ChatOverlay from './ChatOverlay';
import PlayerToolsMenu from './PlayerToolsMenu';
import RtmpPlayer from './RtmpPlayer';
import YoutubePlayer from './YoutubePlayer';
import { useViewerPresence } from '@/hooks/useViewerPresence';
import { getSourceKey } from '@/lib/source-key';
import {
  getFullscreenElement,
  subscribeFullscreenChange,
  toggleFullscreen,
} from '@/lib/fullscreen';

import { Play } from 'lucide-react';

export default function VideoPlayer({
  source,
  chatEpoch = 0,
  embed = false,
  onViewerCountChange,
  isAdmin = false,
  settings = {},
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoMountGen, setVideoMountGen] = useState(0);
  const [youtubeIsLive, setYoutubeIsLive] = useState(false);
  const [rtmpIsLive, setRtmpIsLive] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const hideTimeout = useRef(null);
  const viewerCount = useViewerPresence(!!source);
  const isRtmp = source?.type === 'rtmp';
  const isYoutube = source?.type === 'youtube';
  const sourceKey = getSourceKey(source);
  const chatEnabled = settings.chat_enabled !== false;
  const embedChatDock = embed && chatEnabled;

  useEffect(() => {
    onViewerCountChange?.(viewerCount);
  }, [viewerCount, onViewerCountChange]);

  const handleRtmpPlayingChange = useCallback((playing) => {
    setIsPlaying(playing);
  }, []);

  const handleRtmpVideoReady = useCallback(() => {
    setVideoMountGen((n) => n + 1);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => { showControls(); }, [isPlaying, showControls]);

  useEffect(() => {
    if (!embed) return undefined;
    const onOrientation = () => {
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
    };
    window.addEventListener('orientationchange', onOrientation);
    return () => window.removeEventListener('orientationchange', onOrientation);
  }, [embed]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setYoutubeIsLive(false);
    setRtmpIsLive(false);
    if (source?.type === 'rtmp') {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  }, [source?.type, source?.hlsUrl, source?.url, source?.videoId, source?.playlistId, source?.isLive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isYoutube) return undefined;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    setIsPlaying(!video.paused);
    setCurrentTime(video.currentTime);
    onLoadedMetadata();
    video.volume = volume;
    video.muted = isMuted;

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [isYoutube, isRtmp, source?.url, source?.hlsUrl, videoMountGen, volume, isMuted]);

  const handlePlayPause = () => {
    if (isYoutube) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (val) => {
    setVolume(val);
    const muted = val === 0;
    setIsMuted(muted);
    const video = videoRef.current;
    if (video && !isYoutube) {
      video.volume = val;
      video.muted = muted;
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    const video = videoRef.current;
    if (video && !isYoutube) {
      video.muted = newMuted;
      if (!newMuted && volume > 0) {
        video.volume = volume;
      }
    }
  };

  const handleSeek = (e, skipSeconds, fraction) => {
    if (isYoutube || isRtmp) return;
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    if (skipSeconds) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + skipSeconds));
    } else if (fraction != null) {
      video.currentTime = Math.max(0, Math.min(video.duration, fraction * video.duration));
    }
  };

  const handleFullscreen = async () => {
    const youtubeIframe = isYoutube ? youtubePlayerRef.current?.getIframe?.() : null;

    await toggleFullscreen({
      container: containerRef.current,
      video: videoRef.current,
      iframe: youtubeIframe || null,
      preferNewTab: false,
    });
  };

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(!!getFullscreenElement());
    };
    const unsubscribe = subscribeFullscreenChange(syncFullscreen);

    const video = videoRef.current;
    const onWebkitBegin = () => setIsFullscreen(true);
    const onWebkitEnd = () => setIsFullscreen(false);

    video?.addEventListener('webkitbeginfullscreen', onWebkitBegin);
    video?.addEventListener('webkitendfullscreen', onWebkitEnd);

    return () => {
      unsubscribe();
      video?.removeEventListener('webkitbeginfullscreen', onWebkitBegin);
      video?.removeEventListener('webkitendfullscreen', onWebkitEnd);
    };
  }, [isRtmp, source?.url, source?.hlsUrl, videoMountGen]);

  const renderContent = () => {
    if (!source) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-card to-secondary">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Play className="w-8 h-8 text-primary ml-1" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Select a source to start streaming</p>
        </div>
      );
    }
    if (isYoutube) {
      return (
        <YoutubePlayer
          source={source}
          viewerCount={viewerCount}
          onPlayingChange={setIsPlaying}
          onLiveChange={setYoutubeIsLive}
          onPlayerInstance={(player) => {
            youtubePlayerRef.current = player;
          }}
        />
      );
    }
    if (isRtmp) {
      return (
        <RtmpPlayer
          hlsUrl={source.hlsUrl}
          embed={embed}
          viewerCount={viewerCount}
          videoRef={videoRef}
          onPlayingChange={handleRtmpPlayingChange}
          onLiveChange={setRtmpIsLive}
          onVideoReady={handleRtmpVideoReady}
        />
      );
    }
    if (source.type === 'file') {
      return (
        <video
          ref={videoRef}
          src={source.url}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          playsInline
          onClick={handlePlayPause}
        />
      );
    }
    return null;
  };

  const chatOverlayProps = source && chatEnabled ? {
    key: `${chatEpoch}:${sourceKey || 'none'}`,
    sourceKey,
    chatEpoch,
    viewerCount,
    isAdmin,
    chatEnabled,
    profanityFilter: settings.profanity_filter === true,
    embed,
    hideViewerBadge: (isRtmp && rtmpIsLive) || (isYoutube && youtubeIsLive),
  } : null;

  const videoControls = source && !isYoutube ? (
    <VideoControls
      isPlaying={isPlaying}
      onPlayPause={handlePlayPause}
      volume={volume}
      onVolumeChange={handleVolumeChange}
      isMuted={isMuted}
      onMuteToggle={handleMuteToggle}
      isFullscreen={isFullscreen}
      onFullscreenToggle={handleFullscreen}
      currentTime={currentTime}
      duration={duration}
      onSeek={handleSeek}
      visible={controlsVisible}
      live={isRtmp && rtmpIsLive}
      hideManualExpand={embed}
    />
  ) : null;

  const playerSurfaceClass = embed
    ? `relative min-h-0 w-full max-w-full flex-1 overflow-hidden box-border bg-black ${
        chatOpen
          ? 'rounded-t-xl max-sm:rounded-none sm:rounded-t-xl'
          : 'rounded-xl max-sm:rounded-none sm:rounded-xl'
      }`
    : 'relative aspect-video w-full max-w-full overflow-hidden box-border rounded-xl bg-black';

  const playerSurface = (
    <div
      ref={containerRef}
      className={playerSurfaceClass}
      onMouseMove={showControls}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      onTouchStart={showControls}
    >
      {renderContent()}
      {source && !isYoutube && !embed && (
        <PlayerToolsMenu videoRef={videoRef} visible={controlsVisible || !isPlaying} />
      )}
      {videoControls}
    </div>
  );

  if (!embed) {
    return (
      <div
        ref={containerRef}
        className={playerSurfaceClass}
        onMouseMove={showControls}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        onTouchStart={showControls}
      >
        {renderContent()}
        {source && !isYoutube && (
          <PlayerToolsMenu videoRef={videoRef} visible={controlsVisible || !isPlaying} />
        )}
        {chatOverlayProps && <ChatOverlay {...chatOverlayProps} />}
        {videoControls}
      </div>
    );
  }

  if (embedChatDock && chatOverlayProps) {
    return (
      <ChatOverlay
        {...chatOverlayProps}
        dockLayout
        open={chatOpen}
        onOpenChange={setChatOpen}
        renderDockLayout={({ chrome, dockPanel }) => (
          <div
            className={`embed-player-shell flex h-full w-full min-h-0 gap-0 ${
              chatOpen
                ? 'max-sm:landscape:flex-row flex-col'
                : 'flex-col'
            }`}
          >
            <div
              className={`relative isolate flex min-h-0 min-w-0 flex-col ${
                chatOpen ? 'min-h-[38%] flex-[3] max-sm:landscape:min-h-0 max-sm:landscape:flex-[3]' : 'flex-1'
              }`}
            >
              {playerSurface}
              {chrome}
            </div>
            <div
              className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-white/10 bg-card/95 transition-[flex,height] duration-200 ${
                chatOpen
                  ? 'flex-[2] min-h-[140px] max-h-[42dvh] border max-sm:landscape:max-h-none max-sm:landscape:flex-[2] max-sm:landscape:border-l max-sm:landscape:border-t-0 rounded-b-xl max-sm:rounded-none sm:rounded-b-xl max-sm:landscape:rounded-none max-sm:landscape:rounded-r-xl'
                  : 'h-0 max-h-0 flex-[0] overflow-hidden border-0'
              }`}
              aria-hidden={!chatOpen}
            >
              {dockPanel}
            </div>
          </div>
        )}
      />
    );
  }

  return (
    <div className="embed-player-shell flex h-full w-full min-h-0 flex-col">
      <div
        ref={containerRef}
        className={playerSurfaceClass}
        onMouseMove={showControls}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        onTouchStart={showControls}
      >
        {renderContent()}
        {chatOverlayProps && <ChatOverlay {...chatOverlayProps} />}
        {videoControls}
      </div>
    </div>
  );
}
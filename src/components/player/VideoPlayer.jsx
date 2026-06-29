import React, { useRef, useState, useEffect, useCallback } from 'react';
import VideoControls from './VideoControls';

import ChatOverlay from './ChatOverlay';
import PlayerToolsMenu from './PlayerToolsMenu';
import RtmpPlayer from './RtmpPlayer';
import YoutubePlayer from './YoutubePlayer';
import { useViewerPresence } from '@/hooks/useViewerPresence';
import { getChatSourceKey, getSourceKey } from '@/lib/source-key';
import {
  getFullscreenElement,
  subscribeFullscreenChange,
  toggleFullscreen,
} from '@/lib/fullscreen';

import { Play } from 'lucide-react';
import WatermarkOverlay from './WatermarkOverlay';
import { EMBED_DEFAULT_VOLUME } from '@/lib/embed-volume';
import {
  isEmbedMobileViewport,
  measureEmbedShellHeight,
  observeEmbedShell,
  postEmbedHeight,
  resetEmbedHeightState,
  subscribeEmbedRemeasure,
} from '@/lib/embed-resize';
const CONTROLS_HIDE_MS = 3000;
const EMBED_CONTROLS_HIDE_MS = 9000;

export default function VideoPlayer({
  source,
  chatEpoch = 0,
  embed = false,
  onViewerCountChange,
  isAdmin = false,
  settings = {},
  watermark = null,
  chatOwnerId = null,
  embedId = null,
  autoPlayLoop = false,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const embedShellRef = useRef(null);
  const chatDockRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(() => (embed ? EMBED_DEFAULT_VOLUME : 0.8));
  const [isMuted, setIsMuted] = useState(false);
  const [isMobileEmbed, setIsMobileEmbed] = useState(() =>
    embed ? (typeof window === 'undefined' ? true : isEmbedMobileViewport()) : false
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoMountGen, setVideoMountGen] = useState(0);
  const [youtubeIsLive, setYoutubeIsLive] = useState(false);
  const [rtmpIsLive, setRtmpIsLive] = useState(false);
  const [rtmpNeedsUserStart, setRtmpNeedsUserStart] = useState(false);
  const [chatOpen, setChatOpen] = useState(() => embed && settings.chat_enabled !== false);
  const rtmpStartPlaybackRef = useRef(null);
  const embedAudibleAppliedRef = useRef(false);
  const hideTimeout = useRef(null);
  const viewerCount = useViewerPresence(!!source);
  const isRtmp = source?.type === 'rtmp';
  const isYoutube = source?.type === 'youtube';
  const sourceKey = getChatSourceKey(source, embedId);
  const legacySourceKey = embedId ? getSourceKey(source) : null;
  const chatEnabled = settings.chat_enabled !== false;
  const embedChatDock = embed && chatEnabled;
  const embedVideoFit = embed && isMobileEmbed ? 'cover' : 'contain';

  const getEmbedResizeOptions = useCallback(
    () => ({
      chatDockOpen: embedChatDock && chatOpen,
      collapsed: !embedChatDock || !chatOpen,
      chatDockEl: chatDockRef.current,
    }),
    [embedChatDock, chatOpen]
  );

  const reportEmbedHeight = useCallback(() => {
    const root = embedShellRef.current;
    if (!root) return;
    const options = getEmbedResizeOptions();
    postEmbedHeight(measureEmbedShellHeight(root, options), {
      collapsed: options.collapsed,
    });
  }, [getEmbedResizeOptions]);

  useEffect(() => {
    if (!embed) return undefined;

    const syncMobile = () => setIsMobileEmbed(isEmbedMobileViewport());
    syncMobile();
    window.addEventListener('resize', syncMobile);
    window.addEventListener('orientationchange', syncMobile);
    return () => {
      window.removeEventListener('resize', syncMobile);
      window.removeEventListener('orientationchange', syncMobile);
    };
  }, [embed]);

  useEffect(() => {
    if (!embed || !embedChatDock) return undefined;

    const kickoff = window.setTimeout(reportEmbedHeight, chatOpen ? 280 : 80);
    const root = embedShellRef.current;
    const chatDock = chatDockRef.current;
    const unobserveRoot = root ? observeEmbedShell(root, reportEmbedHeight) : () => {};
    const unobserveChat = chatDock ? observeEmbedShell(chatDock, reportEmbedHeight) : () => {};

    return () => {
      window.clearTimeout(kickoff);
      unobserveRoot();
      unobserveChat();
    };
  }, [embed, embedChatDock, chatOpen, reportEmbedHeight, sourceKey]);

  useEffect(() => {
    onViewerCountChange?.(viewerCount);
  }, [viewerCount, onViewerCountChange]);

  const handleRtmpPlayingChange = useCallback((playing) => {
    setIsPlaying(playing);
  }, []);

  const handleYoutubePlayerInstance = useCallback((player) => {
    youtubePlayerRef.current = player;
  }, []);

  const handleRtmpVideoReady = useCallback(() => {
    setVideoMountGen((n) => n + 1);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    const hideDelay = embed ? EMBED_CONTROLS_HIDE_MS : CONTROLS_HIDE_MS;
    hideTimeout.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, hideDelay);
  }, [embed, isPlaying]);

  useEffect(() => { showControls(); }, [isPlaying, showControls]);

  useEffect(() => {
    if (!embed || !isEmbedMobileViewport()) return undefined;

    const reportMobileLayout = () => {
      setIsMobileEmbed(isEmbedMobileViewport());
      resetEmbedHeightState();
      reportEmbedHeight();
    };

    window.addEventListener('orientationchange', reportMobileLayout);
    const unsubscribeRemeasure = subscribeEmbedRemeasure(reportMobileLayout);

    return () => {
      window.removeEventListener('orientationchange', reportMobileLayout);
      unsubscribeRemeasure();
    };
  }, [embed, reportEmbedHeight]);

  const applyEmbedAudibleVolume = useCallback(() => {
    if (embedAudibleAppliedRef.current) return;
    embedAudibleAppliedRef.current = true;
    setVolume(EMBED_DEFAULT_VOLUME);
    setIsMuted(false);
    const video = videoRef.current;
    if (video) {
      video.volume = EMBED_DEFAULT_VOLUME;
      video.muted = false;
    }
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setYoutubeIsLive(false);
    setRtmpIsLive(false);
    setRtmpNeedsUserStart(false);
    embedAudibleAppliedRef.current = false;
    if (embed) {
      setVolume(EMBED_DEFAULT_VOLUME);
      setIsMuted(false);
    } else {
      setIsMuted(false);
    }
  }, [source?.type, source?.hlsUrl, source?.url, source?.videoId, source?.playlistId, source?.isLive, embed]);

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
    if (!embed || !video.paused) {
      video.muted = isMuted;
    }

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [embed, isYoutube, isRtmp, source?.url, source?.hlsUrl, videoMountGen, volume, isMuted]);

  const handlePlayPause = () => {
    if (isYoutube) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (isRtmp && embed && rtmpNeedsUserStart && rtmpStartPlaybackRef.current) {
        rtmpStartPlaybackRef.current();
        return;
      }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleRtmpUserStartRequired = useCallback((required) => {
    setRtmpNeedsUserStart(required);
  }, []);

  const handleRegisterRtmpStartPlayback = useCallback((startPlayback) => {
    rtmpStartPlaybackRef.current = startPlayback;
  }, []);

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
          onPlayerInstance={handleYoutubePlayerInstance}
        />
      );
    }
    if (isRtmp) {
      return (
        <RtmpPlayer
          hlsUrl={source.hlsUrl}
          replayHlsUrl={source.replayHlsUrl}
          playbackMode={source.playbackMode}
          replayWhenOffline={source.replayWhenOffline === true}
          inputId={source.inputId}
          customerCode={source.customerCode}
          holdingTitle={source.holdingTitle}
          holdingMessage={source.holdingMessage}
          serviceSchedule={source.serviceSchedule}
          embed={embed}
          viewerCount={viewerCount}
          chromeVisible={controlsVisible && !controlsBlocked}
          videoRef={videoRef}
          videoFit={embedVideoFit}
          defaultVolume={embed ? EMBED_DEFAULT_VOLUME : undefined}
          onAudiblePlayback={embed ? applyEmbedAudibleVolume : undefined}
          onPlayingChange={handleRtmpPlayingChange}
          onLiveChange={setRtmpIsLive}
          onVideoReady={handleRtmpVideoReady}
          onUserStartRequiredChange={embed ? handleRtmpUserStartRequired : undefined}
          onRegisterStartPlayback={embed ? handleRegisterRtmpStartPlayback : undefined}
        />
      );
    }
    if (source.type === 'file') {
      return (
        <video
          ref={videoRef}
          src={source.url}
          className={`absolute inset-0 w-full h-full bg-black ${embedVideoFit === 'cover' ? 'object-cover' : 'object-contain'}`}
          playsInline
          autoPlay={autoPlayLoop}
          loop={autoPlayLoop}
          muted={autoPlayLoop ? true : isMuted}
          onClick={handlePlayPause}
        />
      );
    }
    return null;
  };

  const chatOverlayProps = source && chatEnabled ? {
    key: `${chatEpoch}:${sourceKey || 'none'}`,
    sourceKey,
    legacySourceKey,
    chatEpoch,
    viewerCount,
    isAdmin,
    chatOwnerId,
    embedId,
    chatEnabled,
    profanityFilter: settings.profanity_filter === true,
    embed,
    hideViewerBadge: (isRtmp && rtmpIsLive) || (isYoutube && youtubeIsLive),
    giveEnabled: settings.give_enabled === true,
    giveUrl: settings.give_url || null,
    giveLabel: settings.give_label || 'Give',
  } : null;

  const controlsBlocked = embed && isRtmp && rtmpNeedsUserStart;
  const hideEmbedIdleChrome =
    embed && isRtmp && !rtmpIsLive && !isPlaying && !rtmpNeedsUserStart;

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
      visible={controlsVisible && !controlsBlocked && !hideEmbedIdleChrome}
      live={isRtmp && rtmpIsLive}
      hideManualExpand={embed}
      embed={embed}
      compact={embed && isMobileEmbed}
    />
  ) : null;

  const playerSurfaceClass = embed
    ? embedChatDock
      ? 'relative h-full w-full overflow-hidden box-border bg-black'
      : 'relative h-full w-full overflow-hidden box-border bg-black rounded-xl max-sm:rounded-none sm:rounded-xl'
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
      <WatermarkOverlay watermark={watermark} embed={embed} />
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
        <WatermarkOverlay watermark={watermark} embed={embed} />
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
          <div ref={embedShellRef} className="embed-player-shell flex w-full max-w-full flex-col">
            <div
              className={`relative isolate w-full max-w-full shrink-0 overflow-hidden bg-black ${
                chatOpen
                  ? 'aspect-video rounded-t-xl max-sm:rounded-none sm:rounded-t-xl'
                  : 'aspect-video rounded-xl max-sm:rounded-none sm:rounded-xl'
              }`}
            >
              {playerSurface}
              {chrome}
            </div>
            <div
              ref={chatDockRef}
              className={`w-full max-w-full box-border border-white/10 bg-card/95 ${
                chatOpen
                  ? 'h-[min(320px,48dvh)] shrink-0 overflow-hidden border-t rounded-b-xl max-sm:h-[min(420px,62dvh)] max-sm:rounded-none sm:rounded-b-xl'
                  : 'h-0 shrink-0 overflow-hidden border-0 pointer-events-none'
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
    <div
      ref={embedShellRef}
      className={`embed-player-shell relative w-full max-w-full aspect-video overflow-hidden ${
        isMobileEmbed ? 'rounded-none' : 'rounded-xl max-sm:rounded-none sm:rounded-xl'
      }`}
    >
      <div
        ref={containerRef}
        className={playerSurfaceClass}
        onMouseMove={showControls}
        onMouseLeave={() => isPlaying && setControlsVisible(false)}
        onTouchStart={showControls}
      >
        {renderContent()}
        <WatermarkOverlay watermark={watermark} embed={embed} />
        {chatOverlayProps && <ChatOverlay {...chatOverlayProps} />}
        {videoControls}
      </div>
    </div>
  );
}
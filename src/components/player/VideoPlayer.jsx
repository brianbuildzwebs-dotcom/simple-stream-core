import React, { useRef, useState, useEffect, useCallback } from 'react';
import VideoControls from './VideoControls';
import ChatOverlay from './ChatOverlay';
import PlayerToolsMenu from './PlayerToolsMenu';
import RtmpPlayer from './RtmpPlayer';
import YoutubePlayer from './YoutubePlayer';
import { useViewerPresence } from '@/hooks/useViewerPresence';
import { isYoutubeLiveUrl } from '@/lib/youtube';
import { Play } from 'lucide-react';

export default function VideoPlayer({
  source,
  embed = false,
  onViewerCountChange,
  isAdmin = false,
  settings = {},
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoMountGen, setVideoMountGen] = useState(0);
  const [youtubeIsLive, setYoutubeIsLive] = useState(false);
  const hideTimeout = useRef(null);
  const viewerCount = useViewerPresence(!!source);
  const isRtmp = source?.type === 'rtmp';
  const isYoutube = source?.type === 'youtube';

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
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setYoutubeIsLive(source?.isLive || isYoutubeLiveUrl(source?.url));
    // Live streams start muted for browser autoplay — sync UI with actual state
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

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

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

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden ${
        embed ? 'h-full min-h-0 flex-1' : 'aspect-video rounded-xl'
      }`}
      onMouseMove={showControls}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      onTouchStart={showControls}
      onClick={embed ? showControls : undefined}
    >
      {renderContent()}
      {source && !isYoutube && (
        <PlayerToolsMenu videoRef={videoRef} visible={controlsVisible || !isPlaying} />
      )}
      {source && (
        <ChatOverlay
          viewerCount={viewerCount}
          isAdmin={isAdmin}
          chatEnabled={settings.chat_enabled !== false}
          profanityFilter={settings.profanity_filter === true}
          embed={embed}
          hideViewerBadge={isRtmp || (isYoutube && youtubeIsLive)}
        />
      )}
      {source && !isYoutube && (
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
          live={isRtmp}
        />
      )}
    </div>
  );
}
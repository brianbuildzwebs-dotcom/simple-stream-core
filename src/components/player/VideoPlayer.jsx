import React, { useRef, useState, useEffect, useCallback } from 'react';
import VideoControls from './VideoControls';
import ChatOverlay from './ChatOverlay';
import RtmpPlayer from './RtmpPlayer';
import { Play } from 'lucide-react';

export default function VideoPlayer({ source, embed = false, onViewerCountChange, isAdmin = false, settings = {} }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const hideTimeout = useRef(null);

  // Simulated live viewer count — only active when a source is loaded
  useEffect(() => {
    if (!source) {
      setViewerCount(0);
      onViewerCountChange?.(0);
      return;
    }
    const base = 120 + Math.floor(Math.random() * 500);
    setViewerCount(base);
    onViewerCountChange?.(base);
    const interval = setInterval(() => {
      setViewerCount((prev) => {
        const next = Math.max(50, prev + Math.floor(Math.random() * 21) - 10);
        onViewerCountChange?.(next);
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => { showControls(); }, [isPlaying, showControls]);

  // Reset playback state whenever source changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || source?.type === 'youtube') return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [source]);

  const handlePlayPause = () => {
    if (source?.type === 'youtube') return;
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  };

  const handleVolumeChange = (val) => {
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current && source?.type !== 'youtube') {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current && source?.type !== 'youtube') {
      videoRef.current.muted = newMuted;
    }
  };

  // handleSeek(e, skipSeconds, fraction)
  // - skipSeconds: skip ±N seconds (from skip buttons)
  // - fraction: 0..1 position along progress bar (from bar click)
  const handleSeek = (e, skipSeconds, fraction) => {
    if (source?.type === 'youtube') return;
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
    if (source.type === 'youtube') {
      let embedSrc;
      if (source.videoId) {
        const listParam = source.playlistId ? `&list=${source.playlistId}` : '';
        embedSrc = `https://www.youtube.com/embed/${source.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1${listParam}`;
      } else if (source.playlistId) {
        embedSrc = `https://www.youtube.com/embed/videoseries?list=${source.playlistId}&autoplay=1&rel=0&modestbranding=1&playsinline=1`;
      }
      if (!embedSrc) return null;
      return (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={embedSrc}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title="YouTube Player"
        />
      );
    }
    if (source.type === 'rtmp') {
      return <RtmpPlayer source={source} videoRef={videoRef} />;
    }
    if (source.type === 'file') {
      return (
        <video
          ref={videoRef}
          src={source.url}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          onClick={handlePlayPause}
        />
      );
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden ${embed ? 'h-screen' : 'aspect-video rounded-xl'}`}
      onMouseMove={showControls}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
    >
      {renderContent()}
      {source && (
        <ChatOverlay
          viewerCount={viewerCount}
          isAdmin={isAdmin}
          chatEnabled={settings.chat_enabled !== false}
          profanityFilter={settings.profanity_filter === true}
        />
      )}
      {source?.type !== 'youtube' && source && (
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
        />
      )}
    </div>
  );
}
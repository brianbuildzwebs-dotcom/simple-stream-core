import React from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VideoControls({
  isPlaying,
  onPlayPause,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  isFullscreen,
  onFullscreenToggle,
  currentTime,
  duration,
  onSeek,
  visible,
  live = false,
  minimal = false,
}) {
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  if (minimal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
        transition={{ duration: 0.25 }}
        className="absolute bottom-3 right-3 z-40 pointer-events-auto touch-manipulation"
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
      >
        <button
          type="button"
          onClick={onFullscreenToggle}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/85"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 20 }}
      transition={{ duration: 0.25 }}
      className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 sm:pt-16 pb-3 px-3 sm:px-4 pointer-events-auto touch-manipulation safe-area-pb"
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div className="mb-3">
        {live ? (
          <div className="relative h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/80 via-primary/60 to-transparent animate-pulse" />
          </div>
        ) : (
          <div
            className="group cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek(e, null, (e.clientX - rect.left) / rect.width);
            }}
          >
            <div className="relative h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all">
              <div
                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg shadow-primary/50 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progress}%`, transform: `translateX(-50%) translateY(-50%)` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!live && (
            <button
              onClick={() => onSeek(null, -10)}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {!live && (
            <button
              onClick={() => onSeek(null, 10)}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          {/* Volume */}
          <div className="flex items-center gap-1.5 ml-1">
            <button
              type="button"
              onClick={onMuteToggle}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors touch-manipulation"
              aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 sm:w-20 cursor-pointer accent-primary"
              aria-label="Volume"
            />
          </div>

          {!live && (
            <span className="text-xs text-white/60 font-mono ml-2">
              {formatTime(currentTime)}
              {duration > 0 && (
                <span className="text-white/35"> · -{formatTime(duration - currentTime)}</span>
              )}
            </span>
          )}
          {live && (
            <span className="text-xs text-white/60 font-mono ml-2">
              {formatTime(currentTime)}
              <span className="text-red-400 font-semibold uppercase tracking-wide ml-2">Live</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen */}
          <button
            type="button"
            onClick={onFullscreenToggle}
            className="flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center text-white/70 hover:text-white transition-colors touch-manipulation"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5 sm:w-4 sm:h-4" /> : <Maximize className="w-5 h-5 sm:w-4 sm:h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
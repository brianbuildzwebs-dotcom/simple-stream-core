import React, { useState } from 'react';
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
}) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 20 }}
      transition={{ duration: 0.25 }}
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-3 px-4 pointer-events-auto"
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      {/* Progress Bar */}
      <div
        className="mb-3 group cursor-pointer"
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

      {/* Controls Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Skip Back */}
          <button
            onClick={() => onSeek(null, -10)}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {/* Skip Forward */}
          <button
            onClick={() => onSeek(null, 10)}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Volume */}
          <div
            className="flex items-center gap-1 ml-1"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={onMuteToggle}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: showVolumeSlider ? 80 : 0, opacity: showVolumeSlider ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-20 cursor-pointer"
              />
            </motion.div>
          </div>

          {/* Time — elapsed / remaining */}
          <span className="text-xs text-white/60 font-mono ml-2">
            {formatTime(currentTime)}
            {duration > 0 && (
              <span className="text-white/35"> · -{formatTime(duration - currentTime)}</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen */}
          <button
            onClick={onFullscreenToggle}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
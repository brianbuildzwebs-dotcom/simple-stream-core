import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

const PRESETS = [
  { label: 'Mute', value: 0 },
  { label: 'Low', value: 0.35 },
  { label: 'Med', value: 0.65 },
  { label: 'High', value: 1 },
];

export default function EmbedVolumePopover({ volume, isMuted, onVolumeChange, onClose }) {
  const sliderValue = isMuted ? 0 : volume;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className="absolute bottom-full left-0 z-50 mb-2 flex w-[10.5rem] flex-col gap-3 rounded-2xl border border-white/15 bg-black/92 px-3 pb-3 pt-2 shadow-xl backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
          Volume
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white touch-manipulation"
          aria-label="Close volume"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex h-28 items-center justify-center">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={sliderValue}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="h-3 w-28 -rotate-90 origin-center cursor-pointer accent-primary"
          aria-label="Volume"
        />
      </div>

      <div className="grid grid-cols-4 gap-1">
        {PRESETS.map((preset) => {
          const active =
            preset.value === 0
              ? isMuted || volume === 0
              : !isMuted && Math.abs(volume - preset.value) < 0.08;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onVolumeChange(preset.value)}
              className={`rounded-lg px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors touch-manipulation ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
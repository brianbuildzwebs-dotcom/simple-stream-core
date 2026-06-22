import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const PRESETS = [
  { label: 'Mute', value: 0 },
  { label: 'Low', value: 0.35 },
  { label: 'Med', value: 0.65 },
  { label: 'High', value: 1 },
];

function volumePresetLabel(volume, isMuted) {
  if (isMuted || volume === 0) return 'Mute';
  if (volume < 0.45) return 'Low';
  if (volume < 0.8) return 'Med';
  return 'High';
}

export default function EmbedVolumePill({
  volume,
  isMuted,
  onVolumeChange,
  visible,
  live = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  if (!visible) return null;

  const levelLabel = volumePresetLabel(volume, isMuted);
  const sliderValue = isMuted ? 0 : volume;

  return (
    <div
      ref={rootRef}
      className="absolute bottom-[4.25rem] right-3 z-[60] pointer-events-auto touch-manipulation safe-area-pr safe-area-pb"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="mb-2 flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/90 px-3 py-3 shadow-xl backdrop-blur-md"
          >
            <div className="flex h-28 w-10 items-center justify-center">
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
            <div className="grid grid-cols-4 gap-1 w-full min-w-[9.5rem]">
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
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-md transition-colors touch-manipulation ${
          live
            ? 'border-primary/40 bg-primary/25 hover:bg-primary/35'
            : 'border-white/20 bg-black/75 hover:bg-black/90'
        }`}
        aria-label={open ? 'Close volume controls' : 'Adjust volume'}
        aria-expanded={open}
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="h-5 w-5 shrink-0" />
        ) : (
          <Volume2 className="h-5 w-5 shrink-0" />
        )}
        <span>Sound</span>
        <span className="text-[11px] font-medium text-white/70">{levelLabel}</span>
      </button>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Droplets, Lock } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';

const POSITIONS = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
const SIZES = ['small', 'medium', 'large'];

export default function WatermarkConfigurator({ embed, onSave, watermarkLocked = false }) {
  const [text, setText] = useState(embed.watermark_text || `© ${APP_NAME}`);
  const [position, setPosition] = useState(embed.watermark_position || 'bottom_right');
  const [size, setSize] = useState(embed.watermark_size || 'medium');
  const [opacity, setOpacity] = useState(embed.watermark_opacity ?? 0.7);
  const [enabled, setEnabled] = useState(
    watermarkLocked ? true : (embed.is_watermark_enabled ?? true)
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (watermarkLocked) {
      setEnabled(true);
    } else {
      setEnabled(embed.is_watermark_enabled ?? true);
    }
  }, [embed.is_watermark_enabled, watermarkLocked]);

  const buildPayload = (nextEnabled = enabled) => ({
    is_watermark_enabled: watermarkLocked ? true : nextEnabled,
    watermark_text: text,
    watermark_position: position,
    watermark_size: size,
    watermark_opacity: opacity,
  });

  const save = (nextEnabled = enabled) => {
    onSave(buildPayload(nextEnabled));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToggle = () => {
    if (watermarkLocked) return;
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    save(nextEnabled);
  };

  const showCustomizer = watermarkLocked || enabled;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5 text-muted-foreground" /> Watermark Settings
        </label>
        <div className="flex items-center gap-2 shrink-0">
          {watermarkLocked ? (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Lock className="w-3 h-3" />
              Required
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</span>
          )}
          <button
            type="button"
            onClick={handleToggle}
            disabled={watermarkLocked}
            aria-disabled={watermarkLocked}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              watermarkLocked
                ? 'bg-primary/60 cursor-not-allowed opacity-80'
                : enabled
                  ? 'bg-primary'
                  : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${
                enabled || watermarkLocked ? 'left-4' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {watermarkLocked && (
        <p className="text-xs text-muted-foreground">
          Trial and Basic plans always show a watermark on playback. Upgrade to Pro or Premium to
          remove it. You can still customize the text and style below.
          {' '}
          <Link to="/pricing" className="text-primary hover:underline">
            View plans
          </Link>
        </p>
      )}

      {!watermarkLocked && !enabled && (
        <p className="text-xs text-muted-foreground">
          Watermark is off for this embed. Toggle on to customize text and style. Playback will not
          show a watermark.
        </p>
      )}

      {showCustomizer && (
        <div className="space-y-3 pl-2 border-l-2 border-border/50">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Watermark Text</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Size</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
              >
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Opacity: {Math.round(opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-primary h-1 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="inline-block px-3 py-1 bg-secondary rounded-lg text-xs font-medium" style={{ opacity }}>
              {text}
            </div>
            <button
              type="button"
              onClick={() => save()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 border border-primary/20 transition-colors"
            >
              {saved ? (
                <>
                  <Check className="w-3 h-3" />
                  Saved
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
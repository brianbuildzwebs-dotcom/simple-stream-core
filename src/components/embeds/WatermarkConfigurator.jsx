import React, { useState } from 'react';
import { Check, Droplets } from 'lucide-react';
import { APP_NAME } from '@/lib/brand';

const POSITIONS = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
const SIZES = ['small', 'medium', 'large'];

export default function WatermarkConfigurator({ embed, onSave }) {
  const [text, setText] = useState(embed.watermark_text || `© ${APP_NAME}`);
  const [position, setPosition] = useState(embed.watermark_position || 'bottom_right');
  const [size, setSize] = useState(embed.watermark_size || 'medium');
  const [opacity, setOpacity] = useState(embed.watermark_opacity ?? 0.7);
  const [enabled, setEnabled] = useState(embed.is_watermark_enabled ?? true);
  const [saved, setSaved] = useState(false);

  const save = () => {
    onSave({
      is_watermark_enabled: enabled,
      watermark_text: text,
      watermark_position: position,
      watermark_size: size,
      watermark_opacity: opacity,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5 text-muted-foreground" /> Watermark Settings
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{enabled ? 'Enabled' : 'Disabled'}</span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow ${enabled ? 'left-4' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>

      {enabled && (
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
              onClick={save}
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
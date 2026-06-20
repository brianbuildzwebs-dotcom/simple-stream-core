import React from 'react';

const SIZE_CLASS = {
  small: 'text-[10px] px-2 py-0.5',
  medium: 'text-xs px-2.5 py-1',
  large: 'text-sm px-3 py-1.5',
};

function positionClass(position, embed) {
  const bottom = embed
    ? 'bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
    : 'bottom-3 sm:bottom-14';

  const map = {
    top_left: 'top-[max(0.75rem,env(safe-area-inset-top,0px))] left-3 safe-area-pt',
    top_right: 'top-[max(0.75rem,env(safe-area-inset-top,0px))] right-3 safe-area-pt safe-area-pr',
    bottom_left: `${bottom} left-3 safe-area-pb`,
    bottom_right: `${bottom} right-3 safe-area-pb safe-area-pr`,
  };

  return map[position] || map.bottom_right;
}

export default function WatermarkOverlay({ watermark, embed = false }) {
  if (!watermark?.enabled || !watermark?.text) return null;

  const size = SIZE_CLASS[watermark.size] || SIZE_CLASS.medium;
  const position = positionClass(watermark.position, embed);

  return (
    <div
      className={`pointer-events-none absolute z-20 ${position} rounded-md bg-black/45 text-white font-medium backdrop-blur-sm ${size}`}
      style={{ opacity: watermark.opacity ?? 0.7 }}
    >
      {watermark.text}
    </div>
  );
}
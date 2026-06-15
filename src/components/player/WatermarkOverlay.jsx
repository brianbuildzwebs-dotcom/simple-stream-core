import React from 'react';

const SIZE_CLASS = {
  small: 'text-[10px] px-2 py-0.5',
  medium: 'text-xs px-2.5 py-1',
  large: 'text-sm px-3 py-1.5',
};

const POSITION_CLASS = {
  top_left: 'top-3 left-3',
  top_right: 'top-3 right-3',
  bottom_left: 'bottom-14 left-3',
  bottom_right: 'bottom-14 right-3',
};

export default function WatermarkOverlay({ watermark }) {
  if (!watermark?.enabled || !watermark?.text) return null;

  const size = SIZE_CLASS[watermark.size] || SIZE_CLASS.medium;
  const position = POSITION_CLASS[watermark.position] || POSITION_CLASS.bottom_right;

  return (
    <div
      className={`pointer-events-none absolute z-20 ${position} rounded-md bg-black/45 text-white font-medium backdrop-blur-sm ${size}`}
      style={{ opacity: watermark.opacity ?? 0.7 }}
    >
      {watermark.text}
    </div>
  );
}
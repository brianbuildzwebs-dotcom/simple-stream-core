import React from 'react';
import { Users } from 'lucide-react';

function formatViewerCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

export default function LiveBadge({ viewerCount = 0, showViewers = true }) {
  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-none">
      <div className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        LIVE
      </div>
      {showViewers && viewerCount > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 px-2.5 py-1 text-xs font-medium text-white/90">
          <Users className="w-3.5 h-3.5 text-white/70" />
          {formatViewerCount(viewerCount)}
        </div>
      )}
    </div>
  );
}
import React from 'react';
import { Users } from 'lucide-react';

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export default function ViewerCount({ count }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/60 backdrop-blur-xl border border-border/50">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <Users className="w-4 h-4 text-muted-foreground" />
      <span className="text-base font-bold text-foreground">{formatCount(count)}</span>
      <span className="text-sm text-muted-foreground">watching</span>
    </div>
  );
}
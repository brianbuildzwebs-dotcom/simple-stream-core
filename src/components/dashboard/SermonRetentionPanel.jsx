import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Archive, Info } from 'lucide-react';
import { retentionStatusTone } from '@/lib/sermon-retention';

function toneClasses(tone) {
  if (tone === 'destructive') {
    return {
      wrap: 'border-destructive/30 bg-destructive/10',
      icon: 'text-destructive',
      bar: 'bg-destructive',
      title: 'text-destructive',
    };
  }
  if (tone === 'warning') {
    return {
      wrap: 'border-amber-500/30 bg-amber-500/10',
      icon: 'text-amber-500',
      bar: 'bg-amber-500',
      title: 'text-amber-600 dark:text-amber-300',
    };
  }
  return {
    wrap: 'border-primary/25 bg-primary/5',
    icon: 'text-primary',
    bar: 'bg-primary',
    title: 'text-foreground',
  };
}

export default function SermonRetentionPanel({ retention, compact = false }) {
  if (!retention) return null;

  const usage = retention.usage;
  const tone = retentionStatusTone(usage?.status || 'ok');
  const styles = toneClasses(tone);
  const Icon = tone === 'info' ? Archive : AlertTriangle;

  return (
    <div className={`rounded-2xl border p-4 ${styles.wrap}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.icon}`} />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className={`text-sm font-semibold ${styles.title}`}>
              {retention.tierName} sermon storage
            </p>
            <p className="text-xs text-muted-foreground mt-1">{retention.summary}</p>
          </div>

          {usage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-foreground">{usage.slotsLabel}</span>
                <span className="text-muted-foreground">{usage.percentUsed}% used</span>
              </div>
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${styles.bar}`}
                  style={{ width: `${Math.max(usage.percentUsed, usage.usedCount > 0 ? 8 : 0)}%` }}
                />
              </div>
            </div>
          )}

          {usage?.warningMessages?.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-foreground/90">
              {usage.warningMessages.map((message) => (
                <li key={message} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Download MP4 files for sermons you want to archive locally. Older recordings are
              removed automatically when you exceed your plan limit.
            </p>
          )}

          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{usage?.deletePolicy}</span>
          </p>

          {!compact && (
            <Link
              to="/dashboard/sermons"
              className="inline-flex text-xs font-medium text-primary hover:underline"
            >
              Open Sermon Library
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Radio, X } from 'lucide-react';
import { fetchStreamAlerts, markStreamAlertsRead } from '@/lib/stream-alerts-api';

function formatWhen(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function notifyBrowser(alert) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification('Stream went offline', {
      body: alert.message,
      tag: `stream-alert-${alert.id}`,
    });
  } catch {
    // Ignore notification errors in unsupported browsers.
  }
}

export default function StreamAlertsBanner() {
  const [alerts, setAlerts] = useState([]);
  const [unread, setUnread] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const notifiedRef = useRef(new Set());

  const load = async () => {
    try {
      const payload = await fetchStreamAlerts({ limit: 5 });
      const rows = payload.alerts ?? [];
      setAlerts(rows);
      setUnread(payload.unread ?? 0);

      const newestUnread = rows.find((row) => !row.read_at);
      if (newestUnread && !notifiedRef.current.has(newestUnread.id)) {
        notifiedRef.current.add(newestUnread.id);
        notifyBrowser(newestUnread);
      }
    } catch {
      // Alerts are best-effort; ignore transient failures.
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

  const latestUnread = alerts.find((row) => !row.read_at);
  if (!latestUnread || dismissed) return null;

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await markStreamAlertsRead();
      setUnread(0);
    } catch {
      setDismissed(false);
    }
  };

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Stream disconnected</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {latestUnread.message} · {formatWhen(latestUnread.created_at)}
        </p>
        {unread > 1 && (
          <p className="text-[11px] text-muted-foreground mt-1">{unread} unread alerts</p>
        )}
        <Link
          to="/dashboard/streams"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-2"
        >
          <Radio className="w-3 h-3" />
          Check stream keys
        </Link>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss stream alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
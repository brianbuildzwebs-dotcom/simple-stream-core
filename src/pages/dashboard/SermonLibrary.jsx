import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock,
  Download,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react';
import SermonPlayer from '@/components/dashboard/SermonPlayer';
import SermonRetentionPanel from '@/components/dashboard/SermonRetentionPanel';
import { toast } from '@/components/ui/use-toast';
import {
  deleteSermonRecording,
  fetchSermonLibrary,
  downloadSermonRecordingFile,
} from '@/lib/sermon-library-api';

function formatWhen(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function SermonLibrary() {
  const [recordings, setRecordings] = useState([]);
  const [retention, setRetention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeRecording, setActiveRecording] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const payload = await fetchSermonLibrary();
      setRecordings(payload.recordings ?? []);
      setRetention(payload.retention ?? null);
    } catch (error) {
      toast({
        title: 'Could not load sermon library',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (recording) => {
    const confirmed = window.confirm(
      `Delete "${recording.title}"?\n\nThis permanently removes the recording from your account and Cloudflare storage. It cannot be undone.\n\nTip: Download sermons you want to keep — that helps control storage costs, but saving locally is optional.`
    );
    if (!confirmed) return;

    setDeletingId(recording.id);
    try {
      await deleteSermonRecording(recording.id);
      if (activeRecording?.id === recording.id) {
        setActiveRecording(null);
      }
      await load({ showSpinner: false });
      toast({ title: 'Recording deleted' });
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (recording) => {
    setDownloadingId(recording.id);
    try {
      toast({
        title: 'Preparing download',
        description: 'Cloudflare is packaging your MP4. This can take a minute.',
      });
      await downloadSermonRecordingFile(recording.id, recording.title);
      toast({
        title: 'Download started',
        description: 'Your browser should save the MP4 file shortly.',
      });
      await load({ showSpinner: false });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Sermon Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Past services recorded automatically from your live streams. Play in the dashboard or
            download MP4 files for your archives.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load({ showSpinner: false })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-card text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Sync recordings
        </button>
      </div>

      <SermonRetentionPanel retention={retention} compact />

      {activeRecording && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{activeRecording.title}</p>
              <p className="text-xs text-muted-foreground">{formatWhen(activeRecording.recorded_at)}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveRecording(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close player
            </button>
          </div>
          <SermonPlayer hlsUrl={activeRecording.hls_playback_url} title={activeRecording.title} />
        </motion.div>
      )}

      {recordings.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center space-y-3">
          <Video className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-foreground font-medium">No recordings yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Go live with OBS at least once. Cloudflare saves each service automatically — they will
            appear here after your stream ends.
          </p>
          <Link
            to="/dashboard/streams"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Radio className="w-4 h-4" />
            Open Stream Keys
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {recordings.map((recording, index) => (
            <motion.div
              key={recording.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-2xl border border-border/50 bg-card p-4 flex items-start justify-between gap-4 flex-wrap"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{recording.title}</p>
                  {retention?.usage?.nextCountRemoval?.id === recording.id && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                      Next auto-removal
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {recording.stream_name || 'Stream'} · {formatWhen(recording.recorded_at)}
                </p>
                {recording.duration_label && (
                  <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {recording.duration_label}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveRecording(recording)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Play
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(recording)}
                  disabled={downloadingId === recording.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {downloadingId === recording.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download MP4
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(recording)}
                  disabled={deletingId === recording.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                >
                  {deletingId === recording.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
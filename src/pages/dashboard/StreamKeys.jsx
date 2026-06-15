import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Radio, Copy, Check, ToggleLeft, ToggleRight, Trash2, RefreshCw, Eye } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { fetchUserStreamKeys } from '@/lib/subscription';
import {
  createStreamKey,
  deleteStreamKey,
  refreshStreamKey,
  updateStreamKeyStatus,
} from '@/lib/stream-keys-api';
import { normalizeCloudflareRtmpsIngestUrl } from '@/lib/rtmp';
import { toast } from '@/components/ui/use-toast';

function StreamKeyCard({ streamKey, onToggle, onRevoke, onRefresh }) {
  const [copied, setCopied] = useState(null);
  const ingestUrl = normalizeCloudflareRtmpsIngestUrl(streamKey.rtmp_ingest_url);
  const fullRtmp = `${ingestUrl.replace(/\/+$/, '')}/${streamKey.key_value}`;

  const copy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    toast({ title: 'Copied!' });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-2xl border p-5 space-y-4 ${streamKey.is_live ? 'border-red-500/40' : 'border-border/50'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{streamKey.stream_name}</h3>
            {streamKey.is_live && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Created {new Date(streamKey.created_at).toLocaleDateString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(streamKey)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {streamKey.status === 'active' ? (
            <ToggleRight className="w-6 h-6 text-primary" />
          ) : (
            <ToggleLeft className="w-6 h-6" />
          )}
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">RTMP Server</div>
        <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2 border border-border/30">
          <span className="text-xs font-mono text-foreground/80 flex-1 truncate">{ingestUrl}</span>
          <button type="button" onClick={() => copy(ingestUrl, 'server')} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
            {copied === 'server' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Stream Key</div>
        <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2 border border-border/30">
          <span className="text-xs font-mono text-foreground/80 flex-1 truncate">{streamKey.key_value}</span>
          <button type="button" onClick={() => copy(streamKey.key_value, 'key')} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
            {copied === 'key' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {streamKey.hls_playback_url && (
          <>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">HLS Playback</div>
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2 border border-border/30">
              <span className="text-xs font-mono text-foreground/60 flex-1 truncate">{streamKey.hls_playback_url}</span>
              <button type="button" onClick={() => copy(streamKey.hls_playback_url, 'hls')} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                {copied === 'hls' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="w-3.5 h-3.5" />
          <span>{streamKey.viewer_count || 0} viewers</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRefresh(streamKey)}
            title="Reset key"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRevoke(streamKey)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function StreamKeys() {
  const { user } = useAuth();
  const [streamKeys, setStreamKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = async (userId) => {
    const keys = await fetchUserStreamKeys(userId);
    setStreamKeys(keys);
    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    load(user.id);
  }, [user?.id]);

  const createKey = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const key = await createStreamKey(newName.trim());
      setStreamKeys((prev) => [key, ...prev]);
      setNewName('');
      toast({ title: 'Stream key created!' });
    } catch (error) {
      toast({
        title: 'Failed to create stream key',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleKey = async (streamKey) => {
    const newStatus = streamKey.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateStreamKeyStatus(streamKey.id, newStatus);
      setStreamKeys((prev) => prev.map((k) => (k.id === streamKey.id ? updated : k)));
    } catch (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const revokeKey = async (streamKey) => {
    if (!confirm('Are you sure? This stream key will stop working.')) return;
    try {
      await deleteStreamKey(streamKey.id);
      setStreamKeys((prev) => prev.filter((k) => k.id !== streamKey.id));
      toast({ title: 'Stream key deleted' });
    } catch (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    }
  };

  const refreshKey = async (streamKey) => {
    if (!confirm('This will generate a new key value. Update your streaming software after.')) return;
    try {
      const updated = await refreshStreamKey(streamKey.id);
      setStreamKeys((prev) => prev.map((k) => (k.id === streamKey.id ? updated : k)));
      toast({ title: 'Stream key reset!' });
    } catch (error) {
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Stream Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect OBS, vMix, or Streamlabs using Cloudflare Stream RTMPS credentials.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createKey()}
          placeholder="Stream name (e.g. Main Broadcast)..."
          className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
        />
        <button
          type="button"
          onClick={createKey}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {creating ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Create
            </>
          )}
        </button>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-1.5">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">OBS / vMix Setup</p>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>1. Open your streaming software (OBS, vMix, Streamlabs, etc.)</p>
          <p>2. Go to <strong className="text-foreground">Settings → Stream → Custom</strong></p>
          <p>
            3. Paste the <strong className="text-foreground">RTMP Server URL</strong> (starts with{' '}
            <strong className="text-foreground">rtmps://</strong>) into the Server / URL field
          </p>
          <p>
            4. Paste the <strong className="text-foreground">Stream Key</strong> only — not the full URL.
            In vMix use <strong className="text-foreground">Stream Name or Key</strong> for the key.
          </p>
          <p>5. Hit Go Live — your stream appears in embed players linked to this key</p>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {streamKeys.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No stream keys yet</p>
              <p className="text-sm">Create your first stream key above.</p>
            </div>
          ) : (
            streamKeys.map((streamKey) => (
              <StreamKeyCard
                key={streamKey.id}
                streamKey={streamKey}
                onToggle={toggleKey}
                onRevoke={revokeKey}
                onRefresh={refreshKey}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
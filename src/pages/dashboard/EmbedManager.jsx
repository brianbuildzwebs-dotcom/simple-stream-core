import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Copy,
  Check,
  Trash2,
  Eye,
  Globe,
  ChevronDown,
  ChevronUp,
  Code2,
  Radio,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  fetchUserEmbeds,
  fetchUserStreamKeys,
  planRequiresWatermark,
} from '@/lib/subscription';
import { useSubscription } from '@/hooks/useSubscription';
import {
  fetchStreamKeys,
  streamKeyOptionLabel,
  streamKeysForEmbedSelect,
} from '@/lib/stream-keys-api';
import {
  buildEmbedIframeHtml,
  buildEmbedUrl,
  createEmbedInstance,
  deleteEmbedInstance,
  updateEmbedInstance,
} from '@/lib/embeds';
import WatermarkConfigurator from '@/components/embeds/WatermarkConfigurator';
import { toast } from '@/components/ui/use-toast';

function streamKeyLabel(streamKeys, streamKeyId) {
  if (!streamKeyId) return 'No stream key linked';
  const key = streamKeys.find((k) => k.id === streamKeyId);
  if (!key) return 'Stream key unavailable';
  return streamKeyOptionLabel(key);
}

function StreamKeyEditor({ embed, streamKeys, onSave }) {
  const [streamKeyId, setStreamKeyId] = useState(embed.stream_key_id || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStreamKeyId(embed.stream_key_id || '');
  }, [embed.stream_key_id]);

  const save = () => {
    if (!streamKeyId) return;
    onSave(streamKeyId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const orphaned = !embed.stream_key_id;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Radio className="w-3.5 h-3.5 text-muted-foreground" /> Stream Key
      </label>
      <p className="text-[11px] text-muted-foreground">
        Switch which live input powers this embed. Your iframe code and tracking code stay the same.
      </p>
      {orphaned && (
        <p className="text-[11px] text-amber-400">
          This embed lost its stream key (it may have been deleted). Select an active key below.
        </p>
      )}
      {streamKeys.length === 0 ? (
        <p className="text-xs text-muted-foreground">Create a stream key on the Stream Keys page first.</p>
      ) : (
        <div className="flex gap-2">
          <select
            value={streamKeyId}
            onChange={(e) => setStreamKeyId(e.target.value)}
            className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          >
            <option value="">Select stream key...</option>
            {streamKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {streamKeyOptionLabel(key)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={!streamKeyId || streamKeyId === embed.stream_key_id}
            className="px-3 py-2 rounded-xl bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {saved ? <Check className="w-3.5 h-3.5 text-green-400" /> : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

function DomainsEditor({ embed, onSave }) {
  const [domains, setDomains] = useState((embed.allowed_domains || []).join(', '));
  const [saved, setSaved] = useState(false);

  const save = () => {
    const list = domains.split(',').map((d) => d.trim()).filter(Boolean);
    onSave(list);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Allowed Domains
      </label>
      <p className="text-[11px] text-muted-foreground">Leave empty to allow any site. Comma-separated list otherwise.</p>
      <div className="flex gap-2">
        <input
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          placeholder="example.com, shop.example.com"
          className="flex-1 bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={save}
          className="px-3 py-2 rounded-xl bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
        >
          {saved ? <Check className="w-3.5 h-3.5 text-green-400" /> : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function EmbedManager() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { subscription, plan } = useSubscription(user);
  const tierRequiresWatermark = planRequiresWatermark(subscription, plan, user);
  const [embeds, setEmbeds] = useState([]);
  const [streamKeys, setStreamKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [newEmbed, setNewEmbed] = useState({
    name: searchParams.get('name')?.trim() || '',
    video_source_type: 'rtmp',
    video_source_url: '',
    stream_key_id: searchParams.get('stream_key_id')?.trim() || '',
  });

  const loadStreamKeys = useCallback(async () => {
    try {
      const keyPayload = await fetchStreamKeys();
      return streamKeysForEmbedSelect(keyPayload.streamKeys);
    } catch (apiError) {
      console.warn('Stream keys API failed, falling back to Supabase:', apiError.message);
      const rows = await fetchUserStreamKeys(user.id);
      return streamKeysForEmbedSelect(rows);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    setLoading(true);

    const loadAll = async () => {
      const [embedResult, keysResult] = await Promise.allSettled([
        fetchUserEmbeds(user.id),
        loadStreamKeys(),
      ]);

      if (cancelled) return;

      if (embedResult.status === 'fulfilled') {
        setEmbeds(embedResult.value);
      } else {
        setEmbeds([]);
        toast({
          title: 'Could not load embeds',
          description: embedResult.reason?.message || 'Unknown error',
          variant: 'destructive',
        });
      }

      if (keysResult.status === 'fulfilled') {
        const selectableKeys = keysResult.value;
        const preferredKeyId = searchParams.get('stream_key_id')?.trim() || '';
        const preferredKey = selectableKeys.find((key) => key.id === preferredKeyId);
        setStreamKeys(selectableKeys);
        if (selectableKeys.length > 0) {
          setNewEmbed((prev) => ({
            ...prev,
            video_source_type: 'rtmp',
            stream_key_id:
              prev.stream_key_id && selectableKeys.some((key) => key.id === prev.stream_key_id)
                ? prev.stream_key_id
                : preferredKey?.id || selectableKeys[0].id,
          }));
        }
      } else {
        setStreamKeys([]);
        toast({
          title: 'Could not load stream keys',
          description: keysResult.reason?.message || 'Unknown error',
          variant: 'destructive',
        });
      }

      setLoading(false);
    };

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [user?.id, loadStreamKeys, searchParams]);

  const createHint = (() => {
    if (!newEmbed.name.trim()) {
      return 'Step 1: Enter an embed name in the field above (e.g. Homepage Player).';
    }
    if (newEmbed.video_source_type === 'rtmp') {
      if (streamKeys.length === 0) {
        return 'Create a stream key first on the Stream Keys page.';
      }
      if (!newEmbed.stream_key_id) {
        return 'Select which stream key powers this embed.';
      }
    }
    if (newEmbed.video_source_type === 'youtube' && !newEmbed.video_source_url.trim()) {
      return 'Paste a YouTube video or live URL.';
    }
    return null;
  })();

  const canCreate = !creating && !createHint;

  const create = async () => {
    if (!newEmbed.name.trim()) return;
    if (newEmbed.video_source_type === 'rtmp' && !newEmbed.stream_key_id) {
      toast({
        title: 'Select a stream key',
        description: 'Create a stream key first for RTMP embeds.',
        variant: 'destructive',
      });
      return;
    }
    if (newEmbed.video_source_type === 'youtube' && !newEmbed.video_source_url.trim()) {
      toast({
        title: 'YouTube URL required',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const embed = await createEmbedInstance({
        name: newEmbed.name,
        videoSourceType: newEmbed.video_source_type,
        videoSourceUrl: newEmbed.video_source_url,
        streamKeyId: newEmbed.stream_key_id || null,
      });
      setEmbeds((prev) => [embed, ...prev]);
      setNewEmbed({
        name: '',
        video_source_type: 'rtmp',
        video_source_url: '',
        stream_key_id: streamKeys[0]?.id || '',
      });
      setExpandedId(embed.id);
      toast({ title: 'Embed created!' });
    } catch (error) {
      toast({
        title: 'Failed to create embed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const updateEmbed = async (id, data) => {
    try {
      const updated = await updateEmbedInstance(id, data);
      setEmbeds((prev) => prev.map((e) => (e.id === id ? updated : e)));
      toast({ title: 'Embed updated' });
    } catch (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const deleteEmbed = async (id) => {
    if (!confirm('Delete this embed? The embed code will stop working.')) return;
    try {
      await deleteEmbedInstance(id);
      setEmbeds((prev) => prev.filter((e) => e.id !== id));
      toast({ title: 'Embed deleted' });
    } catch (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    }
  };

  const copyEmbed = (embed) => {
    navigator.clipboard.writeText(buildEmbedIframeHtml(embed.tracking_code));
    setCopiedId(embed.id);
    toast({ title: 'Embed code copied!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyEmbedUrl = (embed) => {
    navigator.clipboard.writeText(buildEmbedUrl(embed.tracking_code));
    setCopiedId(`url-${embed.id}`);
    toast({
      title: 'Embed link copied',
      description: 'Paste this exact URL into your site iframe src.',
    });
    setTimeout(() => setCopiedId(null), 2000);
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
        <h1 className="text-2xl font-bold font-heading text-foreground">Embed Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each embed has a unique tracking code. Copy the full block (style, iframe, and one script tag) and paste it into your site.
          Replace any older embed HTML completely — older copies included a second inline script that causes desktop chat flashing.
          On Hostinger, use an HTML/embed widget and stretch the element to full section width on mobile (not a small fixed box).
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Create New Embed</p>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground" htmlFor="embed-name">
            1. Embed name
          </label>
          <input
            id="embed-name"
            value={newEmbed.name}
            onChange={(e) => setNewEmbed((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Homepage Player, Sunday Service, etc."
            className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="embed-source-type">
              2. Source type
            </label>
            <select
              id="embed-source-type"
              value={newEmbed.video_source_type}
              onChange={(e) => {
                const nextType = e.target.value;
                setNewEmbed((prev) => ({
                  ...prev,
                  video_source_type: nextType,
                  stream_key_id:
                    nextType === 'rtmp'
                      ? prev.stream_key_id || streamKeys[0]?.id || ''
                      : prev.stream_key_id,
                }));
              }}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
            >
              <option value="youtube">YouTube</option>
              <option value="rtmp">RTMP Stream</option>
            </select>
          </div>
          {newEmbed.video_source_type === 'rtmp' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="embed-stream-key">
                3. Stream key
              </label>
              {streamKeys.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-xl border border-border/50 bg-secondary/30 px-3 py-2">
                  No stream keys found.{' '}
                  <Link to="/dashboard/streams" className="text-primary hover:underline">
                    Create one on Stream Keys
                  </Link>
                  .
                </p>
              ) : (
                <select
                  id="embed-stream-key"
                  value={newEmbed.stream_key_id}
                  onChange={(e) => setNewEmbed((prev) => ({ ...prev, stream_key_id: e.target.value }))}
                  className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                >
                  <option value="">Select stream key...</option>
                  {streamKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {streamKeyOptionLabel(key)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="embed-youtube-url">
                3. YouTube URL
              </label>
              <input
                id="embed-youtube-url"
                value={newEmbed.video_source_url}
                onChange={(e) => setNewEmbed((prev) => ({ ...prev, video_source_url: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
            </div>
          )}
        </div>
        {createHint && (
          <p className="text-xs text-muted-foreground">{createHint}</p>
        )}
        <button
          type="button"
          onClick={create}
          disabled={!canCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {creating ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Create Embed
            </>
          )}
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {embeds.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Code2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No embeds yet</p>
              <p className="text-sm">Create your first embed player above.</p>
            </div>
          ) : (
            embeds.map((embed) => (
              <motion.div
                key={embed.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl border border-border/50 overflow-hidden"
              >
                <div className="p-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{embed.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Code:{' '}
                      <span className="font-mono break-all">{embed.tracking_code}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => copyEmbedUrl(embed)}
                      className="mt-1 block max-w-full text-left text-xs font-mono text-primary hover:underline break-all"
                      title="Copy preview URL"
                    >
                      {buildEmbedUrl(embed.tracking_code)}
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-muted-foreground capitalize">
                        {embed.video_source_type || 'youtube'}
                      </span>
                      {embed.video_source_type === 'rtmp' && (
                        <span className="text-xs text-muted-foreground">
                          {streamKeyLabel(streamKeys, embed.stream_key_id)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        {embed.total_views || 0} views
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      to={`/dashboard/chat?embed=${embed.id}`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Moderate chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Link>
                    <a
                      href={buildEmbedUrl(embed.tracking_code)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Preview embed"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => copyEmbed(embed)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors border border-primary/20"
                    >
                      {copiedId === embed.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copy Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === embed.id ? null : embed.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      {expandedId === embed.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEmbed(embed.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === embed.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/50"
                    >
                      <div className="p-4 space-y-4">
                        {embed.video_source_type === 'rtmp' && (
                          <StreamKeyEditor
                            embed={embed}
                            streamKeys={streamKeys}
                            onSave={(streamKeyId) => updateEmbed(embed.id, { stream_key_id: streamKeyId })}
                          />
                        )}
                        <WatermarkConfigurator
                          embed={embed}
                          watermarkLocked={tierRequiresWatermark}
                          onSave={(data) => updateEmbed(embed.id, data)}
                        />
                        <DomainsEditor embed={embed} onSave={(domains) => updateEmbed(embed.id, { allowed_domains: domains })} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
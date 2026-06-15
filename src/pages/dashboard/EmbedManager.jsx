import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Copy, Check, Trash2, Eye, Globe, ChevronDown, ChevronUp, Code2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { fetchUserEmbeds, fetchUserStreamKeys } from '@/lib/subscription';
import {
  buildEmbedIframeHtml,
  createEmbedInstance,
  deleteEmbedInstance,
  updateEmbedInstance,
} from '@/lib/embeds';
import WatermarkConfigurator from '@/components/embeds/WatermarkConfigurator';
import { toast } from '@/components/ui/use-toast';

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
  const [embeds, setEmbeds] = useState([]);
  const [streamKeys, setStreamKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [newEmbed, setNewEmbed] = useState({
    name: '',
    video_source_type: 'youtube',
    video_source_url: '',
    stream_key_id: '',
  });

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([fetchUserEmbeds(user.id), fetchUserStreamKeys(user.id)])
      .then(([embedRows, keyRows]) => {
        setEmbeds(embedRows);
        setStreamKeys(keyRows.filter((k) => k.status === 'active'));
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

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
        userId: user.id,
        name: newEmbed.name,
        videoSourceType: newEmbed.video_source_type,
        videoSourceUrl: newEmbed.video_source_url,
        streamKeyId: newEmbed.stream_key_id || null,
      });
      setEmbeds((prev) => [embed, ...prev]);
      setNewEmbed({ name: '', video_source_type: 'youtube', video_source_url: '', stream_key_id: '' });
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
          Each embed has a unique tracking code. Copy the iframe and paste it into any website.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Create New Embed</p>
        <input
          value={newEmbed.name}
          onChange={(e) => setNewEmbed((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Embed name (e.g. Homepage Player)..."
          className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={newEmbed.video_source_type}
            onChange={(e) => setNewEmbed((prev) => ({ ...prev, video_source_type: e.target.value }))}
            className="bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          >
            <option value="youtube">YouTube</option>
            <option value="rtmp">RTMP Stream</option>
          </select>
          {newEmbed.video_source_type === 'rtmp' ? (
            <select
              value={newEmbed.stream_key_id}
              onChange={(e) => setNewEmbed((prev) => ({ ...prev, stream_key_id: e.target.value }))}
              className="bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
            >
              <option value="">Select stream key...</option>
              {streamKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.stream_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={newEmbed.video_source_url}
              onChange={(e) => setNewEmbed((prev) => ({ ...prev, video_source_url: e.target.value }))}
              placeholder="YouTube URL..."
              className="bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
          )}
        </div>
        <button
          type="button"
          onClick={create}
          disabled={creating || !newEmbed.name.trim()}
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
                <div className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{embed.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground font-mono">{embed.tracking_code}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        {embed.total_views || 0} views
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                        <WatermarkConfigurator embed={embed} onSave={(data) => updateEmbed(embed.id, data)} />
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
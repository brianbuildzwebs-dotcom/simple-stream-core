import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

const DEFAULTS = {
  name: '',
  description: '',
  monthly_price: 0,
  max_bitrate_mbps: 5,
  max_concurrent_viewers: 100,
  storage_limit_gb: 10,
  max_stream_keys: 1,
  has_watermark: true,
  support_level: 'email',
  features: [],
  sort_order: 0,
  is_active: true,
  cta_label: 'Get Started',
  is_popular: false,
};

export default function AdminSubscriptions() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [creating, setCreating] = useState(false);
  const [newTier, setNewTier] = useState(DEFAULTS);

  const load = async () => {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    setTiers(data ?? []);
  };

  useEffect(() => {
    load()
      .catch((error) => toast({ title: 'Failed to load tiers', description: error.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async (id) => {
    const { error } = await supabase.from('subscription_tiers').update(editData).eq('id', id);
    if (error) throw error;
    setTiers((prev) => prev.map((tier) => (tier.id === id ? { ...tier, ...editData } : tier)));
    setEditingId(null);
    toast({ title: 'Tier updated — pricing page updated automatically' });
  };

  const create = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .insert(newTier)
        .select('*')
        .single();
      if (error) throw error;
      setTiers((prev) => [...prev, data]);
      setNewTier(DEFAULTS);
      toast({ title: 'Tier created' });
    } catch (error) {
      toast({ title: 'Create failed', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const deleteTier = async (id) => {
    if (!confirm('Delete this tier?')) return;
    const { error } = await supabase.from('subscription_tiers').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setTiers((prev) => prev.filter((tier) => tier.id !== id));
    toast({ title: 'Tier deleted' });
  };

  const startEdit = (tier) => {
    setEditingId(tier.id);
    setEditData({ ...tier });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Subscription Tiers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Changes here update the pricing page automatically.
        </p>
      </div>

      <div className="space-y-4">
        {tiers.map((tier) => (
          <div key={tier.id} className="bg-card rounded-2xl border border-border/50 p-5">
            {editingId === tier.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'name', label: 'Name', type: 'text' },
                    { key: 'monthly_price', label: 'Monthly Price ($)', type: 'number' },
                    { key: 'max_bitrate_mbps', label: 'Max Bitrate (Mbps)', type: 'number' },
                    { key: 'max_concurrent_viewers', label: 'Max Viewers', type: 'number' },
                    { key: 'storage_limit_gb', label: 'Storage (GB)', type: 'number' },
                    { key: 'max_stream_keys', label: 'Stream Keys', type: 'number' },
                    { key: 'cta_label', label: 'Button Label', type: 'text' },
                    { key: 'sort_order', label: 'Sort Order', type: 'number' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-muted-foreground block mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        value={editData[field.key] ?? ''}
                        onChange={(e) =>
                          setEditData((prev) => ({
                            ...prev,
                            [field.key]:
                              field.type === 'number' ? Number(e.target.value) : e.target.value,
                          }))
                        }
                        className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Support Level</label>
                    <select
                      value={editData.support_level}
                      onChange={(e) => setEditData((prev) => ({ ...prev, support_level: e.target.value }))}
                      className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
                    >
                      <option value="email">Email</option>
                      <option value="priority_email">Priority Email</option>
                      <option value="24_7_chat">24/7 Chat</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Description</label>
                  <input
                    value={editData.description || ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-secondary/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editData.has_watermark)}
                      onChange={(e) => setEditData((prev) => ({ ...prev, has_watermark: e.target.checked }))}
                      className="accent-primary"
                    />
                    Has Watermark
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editData.is_popular)}
                      onChange={(e) => setEditData((prev) => ({ ...prev, is_popular: e.target.checked }))}
                      className="accent-primary"
                    />
                    Mark as Popular
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editData.is_active)}
                      onChange={(e) => setEditData((prev) => ({ ...prev, is_active: e.target.checked }))}
                      className="accent-primary"
                    />
                    Active
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => save(tier.id).catch((e) => toast({ title: e.message, variant: 'destructive' }))}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{tier.name}</h3>
                    {tier.is_popular && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        tier.is_active
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    ${tier.monthly_price}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{tier.max_bitrate_mbps} Mbps</span>
                    <span>{tier.max_concurrent_viewers} viewers</span>
                    <span>{tier.storage_limit_gb} GB</span>
                    <span>{tier.max_stream_keys} key(s)</span>
                    <span>{tier.has_watermark ? 'Watermark' : 'No watermark'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(tier)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTier(tier.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-dashed border-border/60 p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">Add New Tier</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input
            value={newTier.name}
            onChange={(e) => setNewTier((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Tier name"
            className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
          <input
            type="number"
            value={newTier.monthly_price}
            onChange={(e) => setNewTier((prev) => ({ ...prev, monthly_price: Number(e.target.value) }))}
            placeholder="Monthly price"
            className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
          <input
            value={newTier.description}
            onChange={(e) => setNewTier((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
            className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
        </div>
        <button
          type="button"
          onClick={create}
          disabled={creating || !newTier.name}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Tier
        </button>
      </div>
    </div>
  );
}
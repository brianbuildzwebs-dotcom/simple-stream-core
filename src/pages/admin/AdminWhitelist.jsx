import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Globe, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

export default function AdminWhitelist() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ domain: '', notes: '' });

  const load = async () => {
    const { data, error } = await supabase
      .from('domain_whitelist')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    setList(data ?? []);
  };

  useEffect(() => {
    load()
      .catch((error) => toast({ title: 'Failed to load whitelist', description: error.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const add = async () => {
    if (!form.domain.trim()) return;
    const { data, error } = await supabase
      .from('domain_whitelist')
      .insert({
        domain: form.domain.trim().toLowerCase(),
        notes: form.notes.trim() || null,
        is_active: true,
      })
      .select('*')
      .single();
    if (error) {
      toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
      return;
    }
    setList((prev) => [data, ...prev]);
    setForm({ domain: '', notes: '' });
    toast({ title: 'Domain whitelisted — watermark exemption active' });
  };

  const remove = async (id) => {
    const { error } = await supabase.from('domain_whitelist').delete().eq('id', id);
    if (error) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
      return;
    }
    setList((prev) => prev.filter((item) => item.id !== id));
    toast({ title: 'Domain removed from whitelist' });
  };

  const toggle = async (item) => {
    const { error } = await supabase
      .from('domain_whitelist')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setList((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, is_active: !row.is_active } : row))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Domain Whitelist</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Whitelisted domains bypass watermarks even on Basic tier.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">Add Domain</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Domain (supports *.example.com)
            </label>
            <input
              value={form.domain}
              onChange={(e) => setForm((prev) => ({ ...prev, domain: e.target.value }))}
              placeholder="example.com"
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Reason (optional)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Enterprise client, partner, etc."
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Whitelisted domains automatically skip the watermark on embeds.
        </p>
        <button
          type="button"
          onClick={add}
          disabled={!form.domain.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add to Whitelist
        </button>
      </div>

      <div className="space-y-2">
        {list.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No whitelisted domains yet.</p>
          </div>
        ) : (
          list.map((item) => (
            <div
              key={item.id}
              className="bg-card rounded-2xl border border-border/50 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck
                  className={`w-5 h-5 shrink-0 ${
                    item.is_active ? 'text-green-400' : 'text-muted-foreground'
                  }`}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm font-mono truncate">
                    {item.domain}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    item.is_active
                      ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                      : 'bg-muted text-muted-foreground border-border hover:bg-secondary'
                  }`}
                >
                  {item.is_active ? 'Active' : 'Inactive'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
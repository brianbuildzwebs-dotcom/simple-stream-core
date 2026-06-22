import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Send } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { fetchMyFeatureSuggestions, submitFeatureSuggestion } from '@/lib/feedback';
import { toast } from '@/components/ui/use-toast';

const PRIORITIES = [
  { value: 'must_have', label: 'Must-have for our church' },
  { value: 'nice_to_have', label: 'Nice to have soon' },
  { value: 'someday', label: 'Someday / future idea' },
];

const STATUS_LABELS = {
  new: 'Received',
  reviewing: 'Reviewing',
  planned: 'Planned',
  shipped: 'Shipped',
  declined: 'Not planned',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  use_case: '',
  priority: 'nice_to_have',
};

export default function SuggestFeature() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const rows = await fetchMyFeatureSuggestions(user.id);
    setSuggestions(rows);
  };

  useEffect(() => {
    load()
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id) return;
    if (!form.title.trim() || !form.description.trim()) {
      toast({
        title: 'Add a title and description',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await submitFeatureSuggestion({
        userId: user.id,
        userEmail: user.email,
        title: form.title,
        description: form.description,
        useCase: form.use_case,
        priority: form.priority,
      });
      setForm(EMPTY_FORM);
      await load();
      toast({
        title: 'Suggestion received',
        description: 'Thank you — we review every idea when planning what to build next.',
      });
    } catch (error) {
      toast({ title: 'Could not send suggestion', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Suggest a feature</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tell us what would make Simple Streamz better for your church.
            </p>
          </div>
        </div>
      </motion.div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border/50 bg-card p-5 space-y-4"
      >
        <div>
          <label className="text-xs font-medium text-foreground">Feature idea</label>
          <input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Sermon replay library on our website"
            className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">What problem would it solve?</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            placeholder="Describe the pain point or workflow this would improve."
            className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 resize-y"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">How would your church use it?</label>
          <textarea
            value={form.use_case}
            onChange={(e) => update('use_case', e.target.value)}
            rows={2}
            placeholder="e.g. Members rewatch Wednesday Bible study during the week"
            className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 resize-y"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">How important is this?</label>
          <select
            value={form.priority}
            onChange={(e) => update('priority', e.target.value)}
            className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          >
            {PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Sending…' : 'Submit suggestion'}
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Your suggestions</h2>
          {suggestions.map((row) => (
            <div key={row.id} className="rounded-xl border border-border/50 bg-card/80 p-4 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground">{row.title}</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase tracking-wide">
                  {STATUS_LABELS[row.status] || row.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
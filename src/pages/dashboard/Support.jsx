import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LifeBuoy, Send } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { fetchMySupportRequests, submitSupportRequest } from '@/lib/feedback';
import { toast } from '@/components/ui/use-toast';

const CATEGORIES = [
  { value: 'streaming', label: 'Live streaming / OBS' },
  { value: 'embed', label: 'Embed on my website' },
  { value: 'chat', label: 'Chat or moderation' },
  { value: 'billing', label: 'Billing or subscription' },
  { value: 'account', label: 'Account or login' },
  { value: 'other', label: 'Something else' },
];

const SEVERITIES = [
  { value: 'blocking', label: "Can't use the service" },
  { value: 'annoying', label: 'Works but frustrating' },
  { value: 'question', label: 'Just a question' },
];

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const EMPTY_FORM = {
  category: 'streaming',
  severity: 'question',
  subject: '',
  description: '',
  steps_tried: '',
  browser_device: '',
  page_url: '',
};

export default function Support() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const rows = await fetchMySupportRequests(user.id);
    setRequests(rows);
  };

  useEffect(() => {
    load()
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.id) return;
    if (!form.subject.trim() || !form.description.trim()) {
      toast({
        title: 'Tell us a bit more',
        description: 'Subject and what happened are required.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await submitSupportRequest({
        userId: user.id,
        userEmail: user.email,
        category: form.category,
        severity: form.severity,
        subject: form.subject,
        description: form.description,
        stepsTried: form.steps_tried,
        browserDevice: form.browser_device,
        pageUrl: form.page_url,
      });
      setForm(EMPTY_FORM);
      await load();
      toast({
        title: 'Support request sent',
        description: 'We received your message. Most issues are reviewed within one business day.',
      });
    } catch (error) {
      toast({ title: 'Could not send request', description: error.message, variant: 'destructive' });
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Support</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Having trouble? Send details and we&apos;ll help you get back to Sunday-ready.
            </p>
          </div>
        </div>
      </motion.div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border/50 bg-card p-5 space-y-4"
      >
        <p className="text-sm font-semibold text-foreground">What do you need help with?</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-foreground">Category</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">How urgent is this?</label>
            <select
              value={form.severity}
              onChange={(e) => update('severity', e.target.value)}
              className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            >
              {SEVERITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">What were you trying to do?</label>
          <input
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            placeholder="e.g. Embed won't go live on our WordPress page"
            className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">What happened?</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={4}
            placeholder="Describe what you see, any error messages, and when it started."
            className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 resize-y"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">What have you already tried?</label>
          <textarea
            value={form.steps_tried}
            onChange={(e) => update('steps_tried', e.target.value)}
            rows={2}
            placeholder="e.g. Refreshed page, checked OBS stream key, hard-refreshed embed"
            className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 resize-y"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-foreground">Browser / device (optional)</label>
            <input
              value={form.browser_device}
              onChange={(e) => update('browser_device', e.target.value)}
              placeholder="e.g. iPhone Safari, Windows Chrome"
              className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Page or embed URL (optional)</label>
            <input
              value={form.page_url}
              onChange={(e) => update('page_url', e.target.value)}
              placeholder="https://yourchurch.org/watch"
              className="mt-1 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Sending…' : 'Submit support request'}
        </button>
      </form>

      {requests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Your previous requests</h2>
          {requests.map((row) => (
            <div key={row.id} className="rounded-xl border border-border/50 bg-card/80 p-4 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground">{row.subject}</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase tracking-wide">
                  {STATUS_LABELS[row.status] || row.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString()} · {row.category.replace(/_/g, ' ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
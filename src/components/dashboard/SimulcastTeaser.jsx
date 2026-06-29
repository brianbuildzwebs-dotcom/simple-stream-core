import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellRing, Radio, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { DEFAULT_SIMULCAST } from '@/lib/launch-config';
import { fetchLaunchConfig } from '@/lib/platform-api';
import { fetchMyFeatureSuggestions, submitFeatureSuggestion } from '@/lib/feedback';
import { toast } from '@/components/ui/use-toast';

const NOTIFY_TITLE = 'Notify: Simulcast to Facebook & YouTube';

export default function SimulcastTeaser() {
  const { user } = useAuth();
  const [simulcast, setSimulcast] = useState(DEFAULT_SIMULCAST);
  const [loading, setLoading] = useState(true);
  const [notified, setNotified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLaunchConfig()
      .then((config) => setSimulcast(config.simulcast))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchMyFeatureSuggestions(user.id)
      .then((rows) => setNotified(rows.some((row) => row.title === NOTIFY_TITLE)))
      .catch(() => {});
  }, [user?.id]);

  if (loading || simulcast.status === 'hidden' || simulcast.status === 'live') {
    return null;
  }

  const isBeta = simulcast.status === 'beta';

  const handleNotify = async () => {
    if (!user?.id || notified) return;
    setSubmitting(true);
    try {
      await submitFeatureSuggestion({
        userId: user.id,
        userEmail: user.email,
        title: NOTIFY_TITLE,
        description: 'Please notify me when simulcast to Facebook and YouTube is available.',
        useCase: 'Dashboard simulcast teaser',
        priority: 'nice_to_have',
      });
      setNotified(true);
      toast({
        title: 'You’re on the list',
        description: 'We’ll email you when simulcast launches.',
      });
    } catch (error) {
      toast({
        title: 'Could not save request',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-card to-card p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
          <Radio className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {simulcast.title || DEFAULT_SIMULCAST.title}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
              <Sparkles className="w-3 h-3" />
              {isBeta ? 'Early access soon' : 'In development'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {simulcast.body || DEFAULT_SIMULCAST.body}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Planned for <strong className="text-foreground">{simulcast.tiers || 'FaithGather+'}</strong>{' '}
            plans. Until then, use OBS dual output to Facebook or YouTube.
          </p>
          <button
            type="button"
            onClick={handleNotify}
            disabled={notified || submitting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/20 transition-colors disabled:opacity-60"
          >
            {notified ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
            {notified ? 'We’ll notify you' : submitting ? 'Saving…' : 'Notify me at launch'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Code2, Clock, Crown, Eye, Activity, Archive, Sparkles } from 'lucide-react';
import ViewerCount from '@/components/player/ViewerCount';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import {
  fetchUserEmbeds,
  getPlanPeriodEndLabel,
  isSubscriptionCancelScheduled,
  isPlatformAdmin,
  isTrialNetworkBlocked,
  needsStripeSync,
} from '@/lib/subscription';
import { fetchStreamKeys } from '@/lib/stream-keys-api';
import OnboardingWizard from '@/components/dashboard/OnboardingWizard';
import SimulcastTeaser from '@/components/dashboard/SimulcastTeaser';
import SermonRetentionPanel from '@/components/dashboard/SermonRetentionPanel';
import { fetchSermonRetentionUsage } from '@/lib/sermon-library-api';
import { confirmCheckoutSession, syncStripeSubscription } from '@/lib/stripe';
import { toast } from '@/components/ui/use-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirmedSessionRef = useRef('');
  const { subscription, plan, planLabel, daysLeft, hasAccess, isPaid, loading, reload } =
    useSubscription(user);
  const [syncing, setSyncing] = useState(false);
  const [streamKeys, setStreamKeys] = useState([]);
  const [embeds, setEmbeds] = useState([]);
  const [guideHidden, setGuideHidden] = useState(false);
  const [guideReopenKey, setGuideReopenKey] = useState(0);
  const [sermonRetention, setSermonRetention] = useState(null);


  useEffect(() => {
    const checkoutState = searchParams.get('checkout');
    if (!checkoutState) return;

    const clearCheckoutParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('checkout');
      next.delete('session_id');
      setSearchParams(next, { replace: true });
    };

    if (checkoutState === 'canceled') {
      clearCheckoutParams();
      return;
    }

    if (checkoutState !== 'success') return;

    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      clearCheckoutParams();
      return;
    }
    if (confirmedSessionRef.current === sessionId) return;
    confirmedSessionRef.current = sessionId;

    confirmCheckoutSession(sessionId)
      .then(async (result) => {
        if (result.activated) {
          await reload();
          toast({
            title: 'Subscription activated',
            description: 'Your new plan limits are active.',
          });
          return;
        }
        toast({
          title: 'Payment processing',
          description: 'Stripe is finalizing your subscription. Use Sync from Stripe on Profile if needed.',
        });
      })
      .catch((error) => {
        toast({
          title: 'Could not confirm checkout',
          description: error.message,
          variant: 'destructive',
        });
      })
      .finally(() => {
        clearCheckoutParams();
      });
  }, [reload, searchParams, setSearchParams]);

  useEffect(() => {
    if (!user?.id) return;

    const loadStreams = () => {
      fetchStreamKeys()
        .then((payload) => setStreamKeys(payload.streamKeys ?? []))
        .catch(() => setStreamKeys([]));
    };

    loadStreams();
    fetchUserEmbeds(user.id).then(setEmbeds).catch(() => setEmbeds([]));

    const interval = window.setInterval(loadStreams, 10000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !hasAccess) {
      setSermonRetention(null);
      return;
    }

    fetchSermonRetentionUsage()
      .then((payload) => setSermonRetention(payload.retention ?? null))
      .catch(() => setSermonRetention(null));
  }, [user?.id, hasAccess]);

  const cancelScheduled = isSubscriptionCancelScheduled(subscription);
  const periodEnd = getPlanPeriodEndLabel(subscription);

  const totalViews = embeds.reduce((sum, embed) => sum + (embed.total_views || 0), 0);
  const totalWatchMin = embeds.reduce(
    (sum, embed) => sum + Number(embed.total_watch_minutes || 0),
    0
  );
  const liveStreams = streamKeys.filter((key) => key.is_live).length;

  const handleRefreshSubscription = async () => {
    setSyncing(true);
    try {
      const result = await syncStripeSubscription();
      await reload();
      if (result.synced) {
        toast({
          title: 'Subscription updated',
          description: result.tierUpdated
            ? 'Your plan details were refreshed from Stripe.'
            : 'Your paid plan is now active on the dashboard.',
        });
      } else {
        const hint =
          result.reason === 'no_customer'
            ? 'Stripe has no customer for this login email. Use the same email you paid with.'
            : 'If you just paid, wait a moment and try again, or check Stripe webhook delivery.';
        toast({
          title: 'No active Stripe subscription found',
          description: hint,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Could not refresh subscription',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: 'Stream Keys', value: streamKeys.length, icon: Radio, color: 'text-purple-400' },
    { label: 'Embed Players', value: embeds.length, icon: Code2, color: 'text-cyan-400' },
    { label: 'Total Views', value: totalViews.toLocaleString(), icon: Eye, color: 'text-green-400' },
    {
      label: 'Watch Hours',
      value: Math.round(totalWatchMin / 60),
      icon: Activity,
      color: 'text-orange-400',
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Streamer'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here&apos;s your streaming overview.</p>
        </div>
        {hasAccess && guideHidden && (
          <button
            type="button"
            onClick={() => setGuideReopenKey((key) => key + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sunday setup guide
          </button>
        )}
      </motion.div>

      {isTrialNetworkBlocked(subscription) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Free trial unavailable from this network</p>
            <p className="text-xs text-muted-foreground mt-1">
              To protect against abuse, trial accounts are limited per location. Subscribe on any plan to
              unlock streaming — shared church offices can contact support.
            </p>
          </div>
          <Link
            to="/pricing"
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            View plans
          </Link>
        </motion.div>
      )}

      {hasAccess && (
        <OnboardingWizard
          userId={user?.id}
          streamKeys={streamKeys}
          embeds={embeds}
          reopenKey={guideReopenKey}
          onHiddenChange={setGuideHidden}
        />
      )}

      {hasAccess && sermonRetention?.usage?.actionRequired && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <SermonRetentionPanel retention={sermonRetention} />
        </motion.div>
      )}

      {hasAccess && <SimulcastTeaser />}

      {isPaid && subscription && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${
            cancelScheduled
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-green-500/30 bg-green-500/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <Crown className={`w-5 h-5 ${cancelScheduled ? 'text-amber-400' : 'text-green-400'}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {cancelScheduled
                  ? `${planLabel || 'Paid'} plan — canceling`
                  : planLabel
                    ? `${planLabel} plan active`
                    : 'Paid plan active'}
              </p>
              <p className="text-xs text-muted-foreground">
                {plan?.max_stream_keys
                  ? `Up to ${plan.max_stream_keys} stream keys`
                  : 'Stream keys and embeds unlocked'}
                {plan?.has_watermark === false ? ' · No watermark' : ''}
                {periodEnd
                  ? ` · ${periodEnd.label} ${new Date(periodEnd.date).toLocaleDateString()}`
                  : ''}
                {cancelScheduled ? ' · No further charges' : ''}
              </p>
            </div>
          </div>
          {needsStripeSync(user, subscription, plan) && (
            <button
              type="button"
              onClick={handleRefreshSubscription}
              disabled={syncing}
              className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {syncing ? 'Syncing…' : 'Sync plan from Stripe'}
            </button>
          )}
        </motion.div>
      )}

      {!isPlatformAdmin(user, subscription) && !isPaid && subscription && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            daysLeft !== null && daysLeft <= 2
              ? 'bg-red-500/10 border-red-500/30'
              : daysLeft !== null && daysLeft <= 7
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-primary/5 border-primary/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock
              className={`w-5 h-5 ${
                daysLeft !== null && daysLeft <= 2 ? 'text-red-400' : 'text-yellow-400'
              }`}
            />
            <div>
              {subscription?.trial_active && daysLeft > 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your free trial
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upgrade before trial ends to keep all your streams and embeds active.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-400">Your trial has expired</p>
                  <p className="text-xs text-muted-foreground">Upgrade now to restore access.</p>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {needsStripeSync(user, subscription, plan) && (
              <button
                type="button"
                onClick={handleRefreshSubscription}
                disabled={syncing}
                className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {syncing ? 'Refreshing…' : 'Already paid? Refresh'}
              </button>
            )}
            <Link
              to="/pricing"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Crown className="w-4 h-4" /> Upgrade
            </Link>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
            className="bg-card rounded-2xl border border-border/50 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        id="dashboard-live-status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`p-4 rounded-2xl flex items-center gap-3 flex-wrap ${
          liveStreams > 0
            ? 'bg-red-500/10 border border-red-500/30'
            : 'bg-secondary/40 border border-border/50'
        }`}
      >
        <Activity className={`w-4 h-4 ${liveStreams > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
        {liveStreams > 0 ? (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-semibold text-red-400">
              {liveStreams} stream{liveStreams > 1 ? 's' : ''} currently LIVE
            </p>
            <div className="flex gap-2 flex-wrap">
              {streamKeys
                .filter((key) => key.is_live)
                .map((key) => (
                  <ViewerCount
                    key={key.id}
                    isLive
                    externalCount={key.viewer_count || undefined}
                  />
                ))}
            </div>
          </>
        ) : (
          <div>
            <p className="text-sm font-semibold text-foreground">Stream status: Offline</p>
            <p className="text-xs text-muted-foreground">
              Start OBS or vMix to go live. Status refreshes every 10 seconds.
            </p>
          </div>
        )}
        <Link
          to="/dashboard/streams"
          className={`ml-auto text-xs hover:underline ${
            liveStreams > 0 ? 'text-red-400' : 'text-primary'
          }`}
        >
          Stream Keys →
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <Link
          to="/dashboard/streams"
          className="group p-5 bg-card rounded-2xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <Radio className="w-6 h-6 text-purple-400 mb-3" />
          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
            Manage Stream Keys
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Generate RTMP stream keys for OBS, vMix, and more.
          </p>
        </Link>
        <Link
          to="/dashboard/embeds"
          className="group p-5 bg-card rounded-2xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <Code2 className="w-6 h-6 text-cyan-400 mb-3" />
          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
            Embed Manager
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Create tracked embed players with unique codes.
          </p>
        </Link>
        <Link
          to="/dashboard/sermons"
          className="group p-5 bg-card rounded-2xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <Archive className="w-6 h-6 text-amber-400 mb-3" />
          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
            Sermon Library
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Play or download past services recorded from your streams.
          </p>
        </Link>
      </motion.div>

      {!hasAccess && user?.role !== 'admin' && (
        <p className="text-xs text-muted-foreground text-center">
          Dashboard shell is active. Upgrade to unlock stream keys and embed management (Phase 2).
        </p>
      )}
    </div>
  );
}
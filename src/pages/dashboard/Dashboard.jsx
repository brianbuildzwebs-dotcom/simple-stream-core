import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, Code2, Clock, Crown, Eye, Activity } from 'lucide-react';
import ViewerCount from '@/components/player/ViewerCount';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { fetchUserStreamKeys, fetchUserEmbeds } from '@/lib/subscription';

export default function Dashboard() {
  const { user } = useAuth();
  const { subscription, daysLeft, hasAccess, isPaid, loading } = useSubscription(user);
  const [streamKeys, setStreamKeys] = useState([]);
  const [embeds, setEmbeds] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    fetchUserStreamKeys(user.id).then(setStreamKeys).catch(() => setStreamKeys([]));
    fetchUserEmbeds(user.id).then(setEmbeds).catch(() => setEmbeds([]));
  }, [user?.id]);

  const totalViews = embeds.reduce((sum, embed) => sum + (embed.total_views || 0), 0);
  const totalWatchMin = embeds.reduce(
    (sum, embed) => sum + Number(embed.total_watch_minutes || 0),
    0
  );
  const liveStreams = streamKeys.filter((key) => key.is_live).length;

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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Welcome back, {user?.full_name?.split(' ')[0] || 'Streamer'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Here&apos;s your streaming overview.</p>
      </motion.div>

      {!isPaid && user?.role !== 'admin' && (
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
          <Link
            to="/pricing"
            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Crown className="w-4 h-4" /> Upgrade
          </Link>
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

      {liveStreams > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 flex-wrap"
        >
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
          <Link to="/dashboard/streams" className="ml-auto text-xs text-red-400 hover:underline">
            Manage →
          </Link>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
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
      </motion.div>

      {!hasAccess && user?.role !== 'admin' && (
        <p className="text-xs text-muted-foreground text-center">
          Dashboard shell is active. Upgrade to unlock stream keys and embed management (Phase 2).
        </p>
      )}
    </div>
  );
}
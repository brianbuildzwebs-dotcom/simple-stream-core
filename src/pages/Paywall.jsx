import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Crown, ArrowRight } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { SUPPORT_EMAIL } from '@/lib/brand';
import PublicHeader from '@/components/layout/PublicHeader';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { isTrialNetworkBlocked } from '@/lib/subscription';

export default function Paywall() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();
  const { hasAccess, loading, subscription } = useSubscription(user);
  const trialBlocked = isTrialNetworkBlocked(subscription);

  if (isLoadingAuth || !authChecked || (isAuthenticated && loading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-4rem)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-6"
      >
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-heading text-foreground">
            {trialBlocked ? 'Subscribe to get started' : 'Your trial has ended'}
          </h1>
          <p className="text-muted-foreground mt-3">
            {trialBlocked
              ? 'Free trials are limited per location to prevent abuse. Choose any plan below to unlock streaming, stream keys, and embeds. Shared church offices can contact support.'
              : 'Your 10-day free trial is over. Upgrade to a paid plan to continue streaming, accessing your stream keys, and using your embed players.'}
          </p>
        </div>
        <div className="space-y-3">
          <Link
            to="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Crown className="w-4 h-4" /> View Plans & Upgrade <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="block py-3 rounded-xl bg-secondary text-foreground/80 hover:bg-secondary/80 transition-colors text-sm"
          >
            Contact Support
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Your stream keys and embeds are preserved — they resume immediately after upgrading.
        </p>
      </motion.div>
      </div>
    </div>
  );
}
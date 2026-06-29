import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, Code2, Radio, Crown, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import VideoPlayer from '@/components/player/VideoPlayer';
import { useAuth } from '@/lib/AuthContext';
import AppLogo from '@/components/brand/AppLogo';

const DEMO_SOURCE = {
  type: 'youtube',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

const FEATURES = [
  {
    icon: Radio,
    label: 'RTMP Live Streaming',
    desc: 'Connect OBS, vMix, or any streaming software via stream key',
  },
  {
    icon: Code2,
    label: 'Trackable Embed Player',
    desc: 'Unique tracking codes with domain, view, and duration analytics',
  },
  {
    icon: Crown,
    label: 'Tiered Plans',
    desc: 'Basic, Pro, Premium — flexible limits for every creator',
  },
  {
    icon: Zap,
    label: '10-Day Free Trial',
    desc: 'Start streaming immediately, no credit card required',
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <AppLogo variant="full" size="2xl" asLink to="/" />
          <div className="flex items-center gap-3">
            <Link
              to="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium"
          >
            <Zap className="w-4 h-4" /> Your custom streaming player platform
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-6xl font-bold font-heading text-foreground leading-tight"
          >
            Stream live.
            <br />
            Embed anywhere.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            Custom embeddable video player with RTMP live streaming, unique tracking codes,
            watermark control, and full analytics. Built for creators, churches, and brands.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              to="/register"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Play className="w-4 h-4" /> Start 10-Day Free Trial
            </Link>
            <Link
              to="/pricing"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-card border border-border/50 text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              View Pricing <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-400" />
              No credit card required
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-400" />
              10-day free trial
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-400" />
              Cancel anytime
            </span>
          </motion.div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border/50 text-xs text-muted-foreground font-medium">
              <Play className="w-3 h-3 text-primary" /> Live Demo Player
            </span>
          </div>
          <div className="relative">
            <VideoPlayer source={DEMO_SOURCE} />
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur text-white/60 text-[10px] font-medium border border-white/10">
              DEMO — Sign up to embed your own
            </div>
          </div>
        </motion.div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.07 }}
              className="bg-card rounded-2xl border border-border/50 p-5 flex gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{feature.label}</p>
                <p className="text-sm text-muted-foreground mt-1">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
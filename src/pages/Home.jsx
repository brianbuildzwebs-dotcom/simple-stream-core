import React from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Play,
  Code2,
  Radio,
  ArrowRight,
  CheckCircle,
  Church,
  Heart,
  Shield,
  MessageSquare,
  Calendar,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import HeroEmbedPreview from '@/components/marketing/HeroEmbedPreview';
import PublicHeader from '@/components/layout/PublicHeader';
import { useAuth } from '@/lib/AuthContext';
import { APP_NAME } from '@/lib/brand';
import AppLogo from '@/components/brand/AppLogo';
import { CHURCH_FAQ, CHURCH_VALUE_PROPS } from '@/lib/church-plans';
import usePageMeta from '@/hooks/usePageMeta';

const FEATURES = [
  {
    icon: Code2,
    label: 'One embed, whole year',
    desc: 'Paste your player once on the website. Swap what’s live from the dashboard — no web volunteer required.',
  },
  {
    icon: Radio,
    label: 'OBS-friendly live streaming',
    desc: 'Connect OBS or your encoder with RTMP. Your congregation watches in a beautiful player on your site.',
  },
  {
    icon: MessageSquare,
    label: 'Family-safe live chat',
    desc: 'Moderate messages, ban users, and turn chat off during worship when you need a reverent moment.',
  },
  {
    icon: Shield,
    label: 'Your domain, your player',
    desc: 'Lock embeds to your church website. Track views so you know Sunday actually worked.',
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Start your free trial',
    desc: 'No credit card. Set up in minutes — even if you’re the only tech volunteer.',
  },
  {
    step: '2',
    title: 'Connect your stream',
    desc: 'Create a stream key, plug OBS in, and copy one embed code for your website.',
  },
  {
    step: '3',
    title: 'Go live with confidence',
    desc: 'Same embed for 9am, 11am, and Wednesday. Chat and moderation ready when you are.',
  },
];

const GATHERINGS = [
  { time: 'Sun 9:00', label: 'Sunday School', note: 'Same embed' },
  { time: 'Sun 10:45', label: 'Early service', note: '2nd feed if live together' },
  { time: 'Sun 6:00', label: 'Evening worship', note: 'Same key' },
  { time: 'Wed 7:00', label: 'Midweek', note: 'Same embed' },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  usePageMeta({
    title: `${APP_NAME} — Church live streaming on your website`,
    description:
      'Live church streaming on your website. One embed code, OBS-ready RTMP, family-safe chat, and analytics. 10-day free trial — no credit card.',
    path: '/',
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium"
            >
              <Church className="w-4 h-4" /> Built for churches with one volunteer
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl md:text-5xl xl:text-6xl font-bold font-heading text-foreground leading-tight"
            >
              Your church live
              <br />
              on your website.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground max-w-xl"
            >
              {APP_NAME} is the full Sunday package — live streaming, embeddable player, safe chat,
              and analytics — without paying enterprise prices or rebuilding your site every week.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <Play className="w-4 h-4" />
                {isAuthenticated ? 'Go to Dashboard' : 'Start 10-Day Free Trial'}
              </Link>
              <Link
                to="/pricing"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-card border border-border/50 text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
              >
                See church plans <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap gap-4 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                No credit card required
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                Plans from $9.99/mo
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                Cancel anytime
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
            id="demo"
          >
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border/50 text-xs text-muted-foreground font-medium">
                <Play className="w-3 h-3 text-primary" /> Same embed player churches use
              </span>
              <span className="px-3 py-1 rounded-full bg-card border border-border/50 text-xs text-muted-foreground">
                Chat-ready
              </span>
              <span className="px-3 py-1 rounded-full bg-card border border-border/50 text-xs text-muted-foreground">
                Mobile-friendly
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border/50 text-xs text-muted-foreground">
                <Heart className="w-3 h-3 text-primary" /> Give-ready
              </span>
            </div>
            <HeroEmbedPreview />
            <p className="text-xs text-muted-foreground text-center">
              FaithGather and FaithCampus plans remove the watermark on your live player.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-border/40 bg-card/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">
              One week at your church
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Multiple services don’t mean multiple websites. One embed handles your whole rhythm.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GATHERINGS.map((item) => (
              <div
                key={item.time}
                className="rounded-xl border border-border/50 bg-card p-4 text-center"
              >
                <p className="text-xs font-semibold text-primary">{item.time}</p>
                <p className="text-sm font-medium text-foreground mt-1">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">
            Sunday-ready in three steps
          </h2>
          <p className="text-muted-foreground mt-2">No seminary degree in web development required</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="bg-card rounded-2xl border border-border/50 p-6"
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="features" className="border-y border-border/40 bg-card/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">
              The full package — without the enterprise price tag
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
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
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {CHURCH_VALUE_PROPS.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.06 }}
              className="rounded-2xl border border-primary/20 bg-primary/5 p-5"
            >
              <Heart className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-12">
        <h2 className="text-xl font-bold font-heading text-foreground text-center mb-6">
          Questions pastors actually ask
        </h2>
        <div className="space-y-4">
          {CHURCH_FAQ.map((item) => (
            <div key={item.q} className="rounded-xl border border-border/50 bg-card p-4">
              <p className="font-medium text-foreground text-sm">{item.q}</p>
              <p className="text-sm text-muted-foreground mt-2">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
          {[
            { icon: Church, label: 'Churches', desc: 'Our first focus' },
            { icon: Calendar, label: 'Events', desc: 'Conferences & specials' },
            { icon: Users, label: 'Creators', desc: 'Also welcome' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-border/40 bg-card/50 p-4">
              <item.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-2xl bg-gradient-to-br from-primary/20 via-card to-accent/10 border border-primary/20 p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-foreground">
            Ready for next Sunday?
          </h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Start your free trial today. Paste your embed this week — stream with confidence
            this Sunday.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {isAuthenticated ? 'Open Dashboard' : 'Start Free Trial'} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-card border border-border/50 text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              Compare FaithGather plans
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <AppLogo variant="full" size="xl" asLink to="/" />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link to="/pricing" className="hover:text-foreground transition-colors">
              Church plans
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="/login" className="hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link to="/register" className="hover:text-foreground transition-colors">
              Start free trial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
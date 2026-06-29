import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Code2,
  Copy,
  MonitorPlay,
  Radio,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { buildEmbedUrl } from '@/lib/embeds';
import { normalizeCloudflareRtmpsIngestUrl } from '@/lib/rtmp';

export const ONBOARDING_STORAGE_PREFIX = 'ssz_onboarding_done_';

export function onboardingStorageKey(userId) {
  return userId ? `${ONBOARDING_STORAGE_PREFIX}${userId}` : null;
}

export function clearOnboardingDismissed(userId) {
  const storageKey = onboardingStorageKey(userId);
  if (storageKey) window.localStorage.removeItem(storageKey);
}

function stepComplete({ streamKeys, embeds }, stepId) {
  if (stepId === 'stream') return streamKeys.length > 0;
  if (stepId === 'embed') return embeds.length > 0;
  return false;
}

function StepAction({ step, linkClassName }) {
  const location = useLocation();

  if (step.external) {
    return (
      <a
        href={step.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        {step.cta}
        <ChevronRight className="w-3 h-3" />
      </a>
    );
  }

  if (step.href === location.pathname) {
    return (
      <button
        type="button"
        onClick={() => {
          const target = step.scrollTo ? document.getElementById(step.scrollTo) : null;
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className={linkClassName}
      >
        {step.cta}
        <ChevronRight className="w-3 h-3" />
      </button>
    );
  }

  return (
    <Link to={step.href} className={linkClassName}>
      {step.cta}
      <ChevronRight className="w-3 h-3" />
    </Link>
  );
}

export default function OnboardingWizard({
  userId,
  streamKeys = [],
  embeds = [],
  reopenKey = 0,
  onHiddenChange,
}) {
  const [dismissed, setDismissed] = useState(false);
  const [reopened, setReopened] = useState(false);
  const [copied, setCopied] = useState(false);

  const storageKey = onboardingStorageKey(userId);

  useEffect(() => {
    if (!storageKey) return;
    if (window.localStorage.getItem(storageKey) === '1') {
      setDismissed(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!reopenKey) return;
    clearOnboardingDismissed(userId);
    setDismissed(false);
    setReopened(true);
  }, [reopenKey, userId]);

  const primaryStream = streamKeys[0];
  const ingestUrl = primaryStream
    ? normalizeCloudflareRtmpsIngestUrl(primaryStream.rtmp_ingest_url)
    : 'rtmps://live.cloudflare.com:443/live/';

  const steps = useMemo(
    () => [
      {
        id: 'stream',
        title: 'Create a stream key',
        body: 'We provision a Cloudflare RTMP feed for OBS or vMix.',
        href: '/dashboard/streams',
        cta: streamKeys.length ? 'Manage stream keys' : 'Create stream key',
        done: streamKeys.length > 0,
      },
      {
        id: 'obs',
        title: 'Connect OBS',
        body: 'Settings → Stream → Custom. Paste server + stream key, then Start Streaming.',
        href: '/dashboard/streams',
        cta: 'View credentials',
        done: streamKeys.length > 0,
      },
      {
        id: 'embed',
        title: 'Build your website player',
        body: 'Create one embed and paste the code on your church site — reuse it every Sunday.',
        href: '/dashboard/embeds',
        cta: embeds.length ? 'Manage embeds' : 'Create embed',
        done: embeds.length > 0,
      },
      {
        id: 'live',
        title: 'Go live before service',
        body: 'Start OBS 10 minutes early. When streaming, live video shows on your website even before the scheduled service time.',
        href: embeds[0]?.tracking_code
          ? buildEmbedUrl(embeds[0].tracking_code)
          : '/dashboard/streams',
        external: Boolean(embeds[0]?.tracking_code),
        cta: embeds[0]?.tracking_code ? 'Preview your player' : 'Check stream status',
        done: streamKeys.some((key) => key.is_live),
      },
    ],
    [streamKeys, embeds]
  );

  const completedCount = steps.filter((step) => step.done).length;
  const allDone = completedCount === steps.length;

  useEffect(() => {
    if (!storageKey || !allDone || dismissed || reopened) return;
    window.localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }, [allDone, dismissed, reopened, storageKey]);

  const isHidden = !userId || dismissed;

  useEffect(() => {
    onHiddenChange?.(isHidden);
  }, [isHidden, onHiddenChange]);

  if (isHidden) return null;

  const handleDismiss = () => {
    if (storageKey) window.localStorage.setItem(storageKey, '1');
    setDismissed(true);
    setReopened(false);
  };

  const copyObsSettings = async () => {
    if (!primaryStream?.key_value) {
      toast({
        title: 'Create a stream key first',
        description: 'We will show OBS credentials after your first key is created.',
      });
      return;
    }

    const text = [
      'OBS → Settings → Stream',
      `Service: Custom`,
      `Server: ${ingestUrl}`,
      `Stream Key: ${primaryStream.key_value}`,
    ].join('\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'OBS settings copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            Sunday setup guide
          </div>
          <h2 className="text-lg font-bold text-foreground mt-1">Get live in four steps</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {completedCount} of {steps.length} complete — most churches finish in under 15 minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss setup guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
              step.done ? 'border-green-500/30 bg-green-500/5' : 'border-border/50 bg-card/60'
            }`}
          >
            <div
              className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                step.done ? 'bg-green-500 text-white' : 'bg-secondary text-muted-foreground'
              }`}
            >
              {step.done ? <Check className="w-3.5 h-3.5" /> : index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.body}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StepAction
                  step={step}
                  linkClassName="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                />
                {step.id === 'obs' && primaryStream && (
                  <button
                    type="button"
                    onClick={copyObsSettings}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    Copy OBS settings
                  </button>
                )}
              </div>
            </div>
            {step.id === 'stream' && <Radio className="w-4 h-4 text-purple-400 shrink-0" />}
            {step.id === 'obs' && <MonitorPlay className="w-4 h-4 text-blue-400 shrink-0" />}
            {step.id === 'embed' && <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />}
            {step.id === 'live' && <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
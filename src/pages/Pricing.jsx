import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchActiveTiers, initUserSubscription } from '@/lib/subscription';
import { confirmCheckoutSession, createCheckoutSession } from '@/lib/stripe';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand';
import { toast } from '@/components/ui/use-toast';

export default function Pricing() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutTierId, setCheckoutTierId] = useState(null);
  const { isAuthenticated, isLoadingAuth, authChecked, user } = useAuth();
  const { isPaid, isExpired, hasAccess, reload } = useSubscription(user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const confirmedSessionRef = useRef('');

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
      toast({
        title: 'Checkout canceled',
        description: 'No charge was made. You can upgrade anytime.',
      });
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

    setConfirmingCheckout(true);
    confirmCheckoutSession(sessionId)
      .then(async (result) => {
        if (result.activated) {
          await initUserSubscription();
          await reload();
          toast({
            title: 'Subscription activated',
            description: 'Your paid plan is active. Head to the dashboard to stream.',
          });
          navigate('/dashboard');
          return;
        }
        toast({
          title: 'Payment processing',
          description: 'Stripe is finalizing your subscription. Refresh in a moment.',
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
        setConfirmingCheckout(false);
        clearCheckoutParams();
      });
  }, [navigate, reload, searchParams, setSearchParams]);

  useEffect(() => {
    fetchActiveTiers()
      .then(setTiers)
      .catch(() => setTiers([]))
      .finally(() => setLoading(false));
  }, []);

  const handleGoToDashboard = () => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }
    if (isExpired && !hasAccess) {
      toast({
        title: 'Trial ended',
        description: 'Choose a plan below and click Subscribe with Stripe to restore access.',
        variant: 'destructive',
      });
      return;
    }
    navigate('/dashboard');
  };

  const handleTierAction = async (tier) => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }

    setCheckoutTierId(tier.id);
    try {
      await createCheckoutSession(tier.id);
    } catch (error) {
      toast({
        title: 'Checkout unavailable',
        description: error.message || 'Stripe is not configured yet. Start your free trial instead.',
        variant: 'destructive',
      });
      setCheckoutTierId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Zap className="w-4 h-4" /> Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-bold font-heading text-foreground">Choose your plan</h1>
          <p className="text-muted-foreground mt-3 text-lg">
            {isAuthenticated
              ? isPaid
                ? 'Manage your plan or return to the dashboard.'
                : isExpired
                  ? 'Your trial has ended. Subscribe below to restore streaming access.'
                  : 'Subscribe now, or continue your free trial from the dashboard.'
              : 'All plans include a 10-day free trial. No credit card required to start.'}
          </p>
        </motion.div>

        {confirmingCheckout && (
          <div className="mb-6 text-center text-sm text-muted-foreground">
            Confirming your subscription…
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : tiers.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">
            Pricing plans are being configured. Check back soon!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-2xl border p-6 ${
                  tier.is_popular
                    ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
                    : 'border-border/50 bg-card'
                }`}
              >
                {tier.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="font-bold text-xl text-foreground font-heading">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{tier.description || ''}</p>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${Number(tier.monthly_price).toFixed(2).replace(/\.00$/, '')}
                    </span>
                    <span className="text-muted-foreground mb-1">/month</span>
                  </div>
                </div>
                <div className="space-y-2.5 mb-6">
                  <FeatureRow label={`${tier.max_bitrate_mbps || '?'} Mbps max bitrate`} />
                  <FeatureRow
                    label={`${(tier.max_concurrent_viewers || 0).toLocaleString()} concurrent viewers`}
                  />
                  <FeatureRow label={`${tier.storage_limit_gb || '?'} GB storage`} />
                  <FeatureRow
                    label={`${tier.max_stream_keys || 1} stream key${
                      (tier.max_stream_keys || 1) > 1 ? 's' : ''
                    }`}
                  />
                  <FeatureRow
                    label={tier.has_watermark ? 'Watermark on videos' : 'No watermark'}
                    ok={!tier.has_watermark}
                  />
                  <FeatureRow label={tier.support_level?.replace(/_/g, ' ') || 'Email support'} />
                  {(tier.features || []).map((feature) => (
                    <FeatureRow key={feature} label={feature} />
                  ))}
                </div>
                {isLoadingAuth || !authChecked ? (
                  <div className="py-3 text-center text-sm text-muted-foreground">Loading…</div>
                ) : isAuthenticated ? (
                  <div className="space-y-2">
                    {isPaid ? (
                      <button
                        type="button"
                        onClick={handleGoToDashboard}
                        className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                          tier.is_popular
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                            : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                        }`}
                      >
                        Go to Dashboard
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTierAction(tier)}
                          disabled={checkoutTierId === tier.id || confirmingCheckout}
                          className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 ${
                            tier.is_popular
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                              : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                          }`}
                        >
                          {checkoutTierId === tier.id
                            ? 'Opening Stripe Checkout…'
                            : `Subscribe — $${Number(tier.monthly_price).toFixed(2).replace(/\.00$/, '')}/mo`}
                        </button>
                        {!isExpired && (
                          <button
                            type="button"
                            onClick={handleGoToDashboard}
                            className="block w-full text-center py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
                          >
                            Continue free trial →
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <Link
                    to="/register"
                    className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                      tier.is_popular
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                        : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                    }`}
                  >
                    {tier.cta_label || 'Start Free Trial'}
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All plans include RTMP streaming, embeddable players, and live chat overlay.</p>
          <p className="mt-1">
            Questions?{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
              Contact us
            </a>
          </p>
          <p className="mt-2 text-xs">
            Powered by {APP_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ label, ok = true }) {
  return (
    <div className="flex items-start gap-2">
      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${ok ? 'text-primary' : 'text-muted-foreground/40'}`} />
      <span className={`text-sm ${ok ? 'text-foreground/80' : 'text-muted-foreground/50'}`}>
        {label}
      </span>
    </div>
  );
}
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchActiveTiers, fetchUserStreamKeys, waitForSubscriptionAccess } from '@/lib/subscription';
import { confirmCheckoutSession, createCheckoutSession } from '@/lib/stripe';
import { getPlanChangeAction } from '@/lib/plan-change';
import PlanChangeConfirmDialog from '@/components/subscription/PlanChangeConfirmDialog';
import { useAuth } from '@/lib/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand';
import { ENTERPRISE_PLAN, enterpriseMailto } from '@/lib/enterprise';
import { getChurchPlanPresentation, INCLUDED_EVERY_PLAN, VALUE_ANCHOR } from '@/lib/church-plans';
import {
  formatLaunchPrice,
  getFutureTierPrice,
  launchOfferIsActive,
} from '@/lib/launch-config';
import { fetchLaunchConfig } from '@/lib/platform-api';
import { toast } from '@/components/ui/use-toast';
import PublicHeader from '@/components/layout/PublicHeader';
import usePageMeta from '@/hooks/usePageMeta';

export default function Pricing() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutTierId, setCheckoutTierId] = useState(null);
  const { isAuthenticated, isLoadingAuth, authChecked, user } = useAuth();
  const { isPaid, isExpired, hasAccess, reload, subscription, plan, planLabel } =
    useSubscription(user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [pendingPlanChange, setPendingPlanChange] = useState(null);
  const [streamKeyCount, setStreamKeyCount] = useState(0);
  const [launchConfig, setLaunchConfig] = useState(null);
  const confirmedSessionRef = useRef('');

  const launchOffer = launchConfig?.launchOffer;
  const showLaunchOffer = launchOfferIsActive(launchOffer);

  usePageMeta({
    title: `Church streaming plans & pricing — ${APP_NAME}`,
    description:
      'Affordable church live streaming plans. One embed for your website, OBS-ready streaming, moderated chat, and analytics. 10-day free trial.',
    path: '/pricing',
  });

  useEffect(() => {
    fetchLaunchConfig().then(setLaunchConfig).catch(() => setLaunchConfig(null));
  }, []);

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
          setCheckoutComplete(true);
          const access = await waitForSubscriptionAccess(user);
          await reload();

          if (access.hasAccess) {
            toast({
              title: 'Subscription activated',
              description: 'Redirecting to your dashboard…',
            });
            navigate('/dashboard', { replace: true });
            return;
          }

          toast({
            title: 'Payment received',
            description: 'Your plan is activating. Use the dashboard button above when ready.',
          });
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
  }, [navigate, reload, searchParams, setSearchParams, user]);

  useEffect(() => {
    fetchActiveTiers()
      .then(setTiers)
      .catch(() => setTiers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setStreamKeyCount(0);
      return;
    }
    fetchUserStreamKeys(user.id)
      .then((keys) => setStreamKeyCount(keys.length))
      .catch(() => setStreamKeyCount(0));
  }, [user?.id]);

  const handleGoToDashboard = async () => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }
    if (checkoutComplete && !hasAccess) {
      const access = await waitForSubscriptionAccess(user, { attempts: 4, delayMs: 500 });
      await reload();
      if (!access.hasAccess) {
        toast({
          title: 'Still activating',
          description: 'Your payment went through. Wait a few seconds and try again.',
        });
        return;
      }
    } else if (isExpired && !hasAccess) {
      toast({
        title: 'Trial ended',
        description: 'Choose a plan below and click Subscribe with Stripe to restore access.',
        variant: 'destructive',
      });
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleTierActionRequest = (tier) => {
    if (!isAuthenticated) {
      navigate('/register');
      return;
    }

    const action = getPlanChangeAction(tier, currentSortOrder, isPaid);
    if (action === 'current') return;
    setPendingPlanChange({ tier, action });
  };

  const handleConfirmPlanChange = async () => {
    if (!pendingPlanChange?.tier) return;

    const { tier, action } = pendingPlanChange;
    setCheckoutTierId(tier.id);
    try {
      const result = await createCheckoutSession(tier.id);
      if (result?.upgraded) {
        await reload();
        setPendingPlanChange(null);
        toast({
          title: action === 'downgrade' ? 'Plan changed' : 'Plan upgraded',
          description:
            action === 'downgrade'
              ? `You're now on ${result.tierName}. Stripe credits unused time on your next invoice.`
              : `You're now on ${result.tierName}. Stripe prorates the difference on your next invoice — no duplicate subscriptions.`,
        });
        setCheckoutTierId(null);
        return;
      }
    } catch (error) {
      toast({
        title: 'Checkout unavailable',
        description: error.message || 'Stripe is not configured yet. Start your free trial instead.',
        variant: 'destructive',
      });
      setCheckoutTierId(null);
    }
  };

  const showDashboardCta = isAuthenticated && (isPaid || checkoutComplete);

  const currentTier =
    tiers.find(
      (tier) =>
        subscription?.subscription_tier_id === tier.id ||
        subscription?.tier_name === tier.name ||
        planLabel === tier.name
    ) || plan;

  const currentSortOrder = currentTier?.sort_order ?? plan?.sort_order ?? -1;

  const isCurrentTier = (tier) =>
    subscription?.subscription_tier_id === tier.id ||
    subscription?.tier_name === tier.name ||
    planLabel === tier.name;

  const isUpgradeTier = (tier) => tier.sort_order > currentSortOrder;
  const isDowngradeTier = (tier) => isPaid && tier.sort_order < currentSortOrder;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        {(showDashboardCta || checkoutComplete || (isAuthenticated && planLabel && planLabel !== 'Free trial')) && (
          <div className="mb-8 rounded-2xl border border-primary/30 bg-primary/10 p-5 text-center">
            <p className="text-foreground font-semibold">
              {checkoutComplete
                ? 'Subscription activated'
                : planLabel
                  ? `You're on ${planLabel}`
                  : 'You have an active plan'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Stream keys and embeds are ready in your dashboard.
            </p>
            <button
              type="button"
              onClick={handleGoToDashboard}
              className="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
            <Zap className="w-4 h-4" /> Church plans — affordable full package
          </div>
          <h1 className="text-4xl font-bold font-heading text-foreground">
            Streaming your whole church can afford
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
            {isAuthenticated
              ? isPaid
                ? planLabel
                  ? `You're on ${planLabel}. Most churches choose FaithGather for Sunday School, Morning, Evening, and Midweek.`
                  : 'Upgrade below, or return to the dashboard.'
                : isExpired
                  ? 'Your trial has ended. Subscribe below to restore streaming access.'
                  : 'Subscribe now, or continue your free trial from the dashboard.'
              : '10-day free trial on every plan. No credit card. One embed handles every service — extra stream keys only when two rooms are live at once.'}
          </p>
        </motion.div>

        {confirmingCheckout && (
          <div className="mb-6 text-center text-sm text-muted-foreground">
            Confirming your subscription…
          </div>
        )}

        {showLaunchOffer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-500/10 via-card to-card p-5 text-center"
          >
            <p className="text-sm font-semibold text-foreground">
              {launchOffer?.headline || 'Launch pricing — limited time'}
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
              {launchOffer?.body ||
                'Subscribe now to lock in today’s rate. Your price stays the same while you remain on the plan.'}
            </p>
            {launchOffer?.offerEndsLabel && (
              <p className="text-xs text-amber-200/90 mt-2 font-medium">{launchOffer.offerEndsLabel}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-3 max-w-xl mx-auto">
              {launchOffer?.grandfatherNote ||
                'Grandfathered pricing applies to active paid subscriptions on the same plan.'}
            </p>
          </motion.div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
            {tiers.map((tier, index) => {
              const church = getChurchPlanPresentation(tier);
              const isCurrent = isCurrentTier(tier);
              const showBadge = church.badge || isCurrent;
              const futurePrice = getFutureTierPrice(tier.name, launchOffer);
              const showFuturePrice =
                showLaunchOffer &&
                futurePrice != null &&
                Number(futurePrice) > Number(tier.monthly_price);

              return (
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
                {showBadge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        isCurrent
                          ? 'bg-green-500 text-white'
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {isCurrent ? 'Your plan' : church.badge || 'Most Popular'}
                    </span>
                  </div>
                )}
                <div className="mb-5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {tier.name}
                  </p>
                  <h3 className="font-bold text-xl text-foreground font-heading">{church.displayName}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{church.tagline}</p>
                  {church.idealFor && (
                    <p className="text-xs text-primary/90 mt-2">{church.idealFor}</p>
                  )}
                  <div className="mt-4 space-y-1">
                    {showFuturePrice && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="line-through decoration-red-400/80">
                          {formatLaunchPrice(futurePrice)}
                        </span>
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                          Launch rate
                        </span>
                      </div>
                    )}
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${Number(tier.monthly_price).toFixed(2).replace(/\.00$/, '')}
                      </span>
                      <span className="text-muted-foreground mb-1">/month</span>
                    </div>
                    {showFuturePrice && (
                      <p className="text-[11px] text-muted-foreground">
                        Lock in this price — grandfathered while you stay subscribed.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2.5 mb-6">
                  {church.featureRows.map((label) => (
                    <FeatureRow key={label} label={label} />
                  ))}
                </div>
                {isLoadingAuth || !authChecked ? (
                  <div className="py-3 text-center text-sm text-muted-foreground">Loading…</div>
                ) : isAuthenticated ? (
                  <div className="space-y-2">
                    {isPaid ? (
                      isCurrentTier(tier) ? (
                        <button
                          type="button"
                          onClick={handleGoToDashboard}
                          className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                            tier.is_popular
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                              : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                          }`}
                        >
                          Your plan — Dashboard
                        </button>
                      ) : isUpgradeTier(tier) ? (
                        <button
                          type="button"
                          onClick={() => handleTierActionRequest(tier)}
                          disabled={checkoutTierId === tier.id || confirmingCheckout}
                          className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 ${
                            tier.is_popular
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                              : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
                          }`}
                        >
                          {checkoutTierId === tier.id
                            ? 'Opening Stripe Checkout…'
                            : `Upgrade — $${Number(tier.monthly_price).toFixed(2).replace(/\.00$/, '')}/mo`}
                        </button>
                      ) : isDowngradeTier(tier) ? (
                        <button
                          type="button"
                          onClick={() => handleTierActionRequest(tier)}
                          disabled={checkoutTierId === tier.id || confirmingCheckout}
                          className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                        >
                          {checkoutTierId === tier.id
                            ? 'Processing…'
                            : `Downgrade — $${Number(tier.monthly_price).toFixed(2).replace(/\.00$/, '')}/mo`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="block w-full text-center py-3 rounded-xl font-semibold text-sm bg-secondary/40 text-muted-foreground border border-border/50 cursor-not-allowed"
                        >
                          Included in your plan
                        </button>
                      )
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleTierActionRequest(tier)}
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
            );
            })}
            <EnterprisePricingCard
              isAuthenticated={isAuthenticated}
              isPaid={isPaid}
              planLabel={planLabel}
            />
          </div>
        )}

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <h2 className="text-lg font-bold text-foreground font-heading">Included on every plan</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Full church streaming stack — not à-la-carte add-ons.
            </p>
            <div className="space-y-2">
              {INCLUDED_EVERY_PLAN.map((feature) => (
                <FeatureRow key={feature} label={feature} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
            <h2 className="text-lg font-bold text-foreground font-heading">{VALUE_ANCHOR.headline}</h2>
            <p className="text-sm text-muted-foreground mt-2">{VALUE_ANCHOR.body}</p>
            <div className="mt-5 space-y-3">
              {VALUE_ANCHOR.comparison.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card/80 px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-semibold text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-sm text-muted-foreground max-w-2xl mx-auto space-y-2">
          <p>
            <strong className="text-foreground">One embed</strong> on your site works for every
            service. Extra stream keys are only for{' '}
            <strong className="text-foreground">two rooms live at the same time</strong> (e.g.
            sanctuary + Sunday School).
          </p>
          <p>
            Questions?{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
      </div>

      <PlanChangeConfirmDialog
        open={Boolean(pendingPlanChange)}
        onOpenChange={(open) => {
          if (!open && !checkoutTierId) setPendingPlanChange(null);
        }}
        tier={pendingPlanChange?.tier}
        action={pendingPlanChange?.action}
        planLabel={planLabel}
        plan={plan}
        streamKeyCount={streamKeyCount}
        onConfirm={handleConfirmPlanChange}
        loading={Boolean(checkoutTierId)}
      />
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

function EnterprisePricingCard({ isAuthenticated, isPaid, planLabel }) {
  const onPremium = planLabel === 'Premium';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="relative rounded-2xl border border-dashed border-border/80 bg-card/80 p-6"
    >
      {onPremium && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">
            Need more keys?
          </span>
        </div>
      )}
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Custom
        </p>
        <h3 className="font-bold text-xl text-foreground font-heading">FaithNetwork</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Dioceses, networks, and multi-site ministries with custom limits and onboarding.
        </p>
        <div className="mt-4 flex items-end gap-1">
          <span className="text-3xl font-bold text-foreground">Custom pricing</span>
        </div>
      </div>
      <div className="space-y-2.5 mb-6">
        {ENTERPRISE_PLAN.features.map((feature) => (
          <FeatureRow key={feature} label={feature} />
        ))}
      </div>
      <a
        href={enterpriseMailto('Enterprise plan inquiry')}
        className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all bg-secondary text-foreground hover:bg-secondary/80 border border-border"
      >
        Contact us for pricing
      </a>
      {isAuthenticated && isPaid && onPremium && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Premium includes up to 10 stream keys. Enterprise adds custom limits.
        </p>
      )}
    </motion.div>
  );
}
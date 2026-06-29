import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CreditCard,
  Crown,
  Droplets,
  Mail,
  RefreshCw,
  Shield,
  Trash2,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { deleteAccount } from '@/lib/account-api';
import DeleteAccountDialog from '@/components/account/DeleteAccountDialog';
import MfaSettings from '@/components/auth/MfaSettings';
import { useSubscription } from '@/hooks/useSubscription';
import {
  canCancelSubscription,
  canManageSubscription,
  fetchActiveTiers,
  fetchUserStreamKeys,
  getPlanPeriodEndLabel,
  isManualBilling,
  isPlatformAdmin,
  isSubscriptionCancelScheduled,
  needsStripeSync,
  planRequiresWatermark,
  resolveCurrentTierSortOrder,
  usesStripeBilling,
} from '@/lib/subscription';
import { ENTERPRISE_PLAN, enterpriseMailto, isActiveEnterprisePlan } from '@/lib/enterprise';
import { fetchEnterpriseOffer, respondToEnterpriseOffer } from '@/lib/enterprise-api';
import {
  cancelSubscription,
  confirmCheckoutSession,
  createCheckoutSession,
  openBillingPortal,
  syncStripeSubscription,
} from '@/lib/stripe';
import { filterSelfServeTiers, getPlanChangeAction } from '@/lib/plan-change';
import PlanChangeConfirmDialog from '@/components/subscription/PlanChangeConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';

export default function Profile() {
  const { user, logout } = useAuth();
  const { subscription, plan, planLabel, daysLeft, isPaid, loading, reload } = useSubscription(user);
  const [syncing, setSyncing] = useState(false);
  const [checkoutTierId, setCheckoutTierId] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const confirmedSessionRef = useRef('');
  const [enterpriseOffer, setEnterpriseOffer] = useState(null);
  const [enterpriseRequest, setEnterpriseRequest] = useState(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const [offerAction, setOfferAction] = useState(null);
  const [billingAction, setBillingAction] = useState(null);
  const [streamKeyCount, setStreamKeyCount] = useState(0);
  const [pendingPlanChange, setPendingPlanChange] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const profileTab = searchParams.get('tab') === 'upgrade' ? 'upgrade' : 'account';

  const isAdmin = isPlatformAdmin(user, subscription);
  const enterprisePlan = isActiveEnterprisePlan(subscription);
  const showBillingControls = canManageSubscription(subscription, user);
  const stripeBilling = usesStripeBilling(subscription, user);
  const manualBilling = isManualBilling(subscription);
  const cancelScheduled = isSubscriptionCancelScheduled(subscription);
  const periodEnd = getPlanPeriodEndLabel(subscription);
  const showCancelButton = canCancelSubscription(subscription, user);

  const showStripeSync = needsStripeSync(user, subscription, plan);
  const watermarkRequired = planRequiresWatermark(subscription, plan, user);
  const currentSortOrder = resolveCurrentTierSortOrder(subscription, plan, tiers);

  useEffect(() => {
    fetchActiveTiers()
      .then(setTiers)
      .catch(() => setTiers([]));
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

  useEffect(() => {
    if (!user?.id) {
      setEnterpriseOffer(null);
      setOfferLoading(false);
      return;
    }

    setOfferLoading(true);
    fetchEnterpriseOffer()
      .then((payload) => {
        setEnterpriseOffer(payload.offer);
        setEnterpriseRequest(payload.request);
      })
      .catch(() => {
        setEnterpriseOffer(null);
        setEnterpriseRequest(null);
      })
      .finally(() => setOfferLoading(false));
  }, [user?.id, subscription?.enterprise_offer_tier_id]);

  useEffect(() => {
    if (searchParams.get('billing') !== 'return') return;

    const clearBillingParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('billing');
      setSearchParams(next, { replace: true });
    };

    syncStripeSubscription()
      .then(() => reload())
      .then(() => {
        toast({
          title: 'Billing updated',
          description: 'Your plan status has been refreshed from Stripe.',
        });
      })
      .catch(() => {
        reload().catch(() => {});
        toast({
          title: 'Billing updated',
          description: 'Returned from Stripe. Use Sync plan from Stripe if dates look off.',
        });
      })
      .finally(clearBillingParam);
  }, [reload, searchParams, setSearchParams]);

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

    confirmCheckoutSession(sessionId)
      .then(async (result) => {
        if (result.activated) {
          await reload();
          toast({
            title: 'Subscription activated',
            description: 'Your plan is active. Embed watermarks should be removed on Pro and above.',
          });
          return;
        }
        toast({
          title: 'Payment processing',
          description: 'Stripe is finalizing your subscription. Use Sync from Stripe in a moment.',
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncStripeSubscription();
      await reload();
      if (result.skipped && result.reason === 'manual_billing') {
        toast({
          title: 'Manual billing active',
          description: 'Your Enterprise plan is managed directly with Simple Streamz, not Stripe.',
        });
      } else if (result.synced) {
        toast({
          title: 'Subscription updated',
          description: result.tierUpdated
            ? 'Your plan details were refreshed from Stripe.'
            : 'Your paid plan is now active.',
        });
      } else {
        const modeHint =
          result.stripe_mode === 'live'
            ? 'Worker is using live Stripe keys — confirm Stripe Dashboard is in Live mode (not Test).'
            : result.stripe_mode === 'test'
              ? 'Worker is using test Stripe keys — switch Stripe Dashboard to Test mode, or upload sk_live_ to the Worker.'
              : '';
        const hint =
          result.reason === 'no_customer'
            ? 'Stripe has no customer for this login email. Use the same email you paid with, or check Stripe Dashboard → Customers.'
            : result.reason === 'manual_billing'
              ? 'Your plan is billed manually, not through Stripe.'
              : ['If you just paid, wait a moment and try again.', modeHint, 'Confirm webhook checkout.session.completed returns 200.']
                  .filter(Boolean)
                  .join(' ');
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

  const handleEnterpriseResponse = async (action) => {
    setOfferAction(action);
    try {
      await respondToEnterpriseOffer(action);
      await reload();
      setEnterpriseOffer(null);
      toast({
        title: action === 'accept' ? 'Enterprise plan activated' : 'Offer declined',
        description:
          action === 'accept'
            ? 'Your new limits are active. Any previous Stripe subscription was canceled automatically.'
            : 'You can keep your current plan.',
      });
    } catch (error) {
      toast({
        title: 'Could not update offer',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setOfferAction(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    setBillingAction('portal');
    try {
      await openBillingPortal(`${window.location.origin}/dashboard/profile?billing=return`);
    } catch (error) {
      toast({
        title: 'Could not open billing',
        description: error.message,
        variant: 'destructive',
      });
      setBillingAction(null);
    }
  };

  const handleCancelPlan = async () => {
    const message = manualBilling
      ? 'Cancel your Enterprise plan now? Dashboard access and stream keys will stop immediately. You can resubscribe anytime from Pricing.'
      : stripeBilling
        ? 'Cancel your subscription at the end of the current billing period? You keep access until then, and you will not be charged again.'
        : 'Cancel your plan?';

    if (!window.confirm(message)) return;

    setBillingAction('cancel');
    try {
      const result = await cancelSubscription({ immediate: manualBilling });
      await reload();
      if (result.mode === 'manual') {
        toast({
          title: 'Plan canceled',
          description: 'Your Enterprise plan has ended. Resubscribe anytime from Pricing.',
        });
        return;
      }
      if (result.immediate) {
        toast({
          title: 'Plan canceled',
          description: 'Your subscription has ended.',
        });
        return;
      }
      toast({
        title: 'Cancellation scheduled',
        description: result.cancelAt
          ? `Your plan stays active until ${new Date(result.cancelAt).toLocaleDateString()}.`
          : 'Your plan will end at the close of this billing period.',
      });
    } catch (error) {
      toast({
        title: 'Could not cancel plan',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBillingAction(null);
    }
  };

  const setProfileTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'upgrade') {
      next.set('tab', 'upgrade');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  const handlePlanChangeRequest = (tier) => {
    const action = getPlanChangeAction(tier, currentSortOrder, isPaid);
    if (action === 'current') return;
    setPendingPlanChange({ tier, action });
  };

  const handleDeleteAccount = async (confirmPhrase) => {
    setDeletingAccount(true);
    try {
      await deleteAccount({ confirmPhrase });
      setDeleteDialogOpen(false);
      toast({
        title: 'Account deleted',
        description: 'Your data has been removed from Simple Streamz.',
      });
      await logout(true);
    } catch (error) {
      toast({
        title: 'Could not delete account',
        description: error.message,
        variant: 'destructive',
      });
      setDeletingAccount(false);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!pendingPlanChange?.tier) return;

    const { tier, action } = pendingPlanChange;
    setCheckoutTierId(tier.id);
    try {
      const result = await createCheckoutSession(tier.id, {
        successUrl: `${window.location.origin}/dashboard/profile?tab=upgrade&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/dashboard/profile?tab=upgrade&checkout=canceled`,
      });
      if (result?.upgraded) {
        await reload();
        setPendingPlanChange(null);
        toast({
          title: action === 'downgrade' ? 'Plan changed' : 'Plan upgraded',
          description:
            action === 'downgrade'
              ? `You're now on ${result.tierName}. Stripe credits unused time on your next invoice.`
              : `You're now on ${result.tierName}. Stripe prorates the difference — you won't be double billed.`,
        });
        setCheckoutTierId(null);
      }
    } catch (error) {
      toast({
        title: 'Plan change failed',
        description: error.message,
        variant: 'destructive',
      });
      setCheckoutTierId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold font-heading text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Account details, plan status, billing, and upgrades.
        </p>
      </motion.div>

      <Tabs value={profileTab} onValueChange={setProfileTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="upgrade">Upgrade</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6 mt-0">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{user?.full_name || 'User'}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {user?.email}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Platform administrator
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
        <MfaSettings emphasizeAdmin={isAdmin} />
      </motion.div>

      {!offerLoading && enterpriseRequest?.pending && !enterpriseOffer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary/40 rounded-2xl border border-border/50 p-5 space-y-2"
        >
          <p className="text-sm font-semibold text-foreground">Enterprise request received</p>
          <p className="text-xs text-muted-foreground">
            We are preparing your custom plan. When it is ready, an approval banner will appear here.
            This happens in the app only — we do not email you for this step.
          </p>
          {enterpriseRequest.note && (
            <p className="text-xs text-muted-foreground">Your note: {enterpriseRequest.note}</p>
          )}
        </motion.div>
      )}

      {!offerLoading && enterpriseOffer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 rounded-2xl border border-amber-500/30 p-5 space-y-4"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">
              Enterprise upgrade available
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Simple Streamz prepared a custom {enterpriseOffer.tier.name} plan for your account.
              Accept to activate your new limits. Check here on Profile — no email is sent.
              Manual billing will not be overwritten by Stripe sync.
            </p>
            <ul className="mt-3 text-xs text-foreground/80 space-y-1">
              <li>
                Up to <strong>{enterpriseOffer.tier.max_stream_keys}</strong> stream keys
              </li>
              <li>{enterpriseOffer.tier.has_watermark ? 'Watermark on embeds' : 'No watermark'}</li>
            </ul>
            {enterpriseOffer.note && (
              <p className="mt-3 text-xs text-amber-100/90 rounded-lg bg-black/20 px-3 py-2">
                {enterpriseOffer.note}
              </p>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Accepting will switch you to manual Enterprise billing. Any active Stripe subscription
              is canceled automatically so you are not billed twice.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleEnterpriseResponse('accept')}
              disabled={offerAction}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {offerAction === 'accept' ? 'Activating…' : 'Accept Enterprise plan'}
            </button>
            <button
              type="button"
              onClick={() => handleEnterpriseResponse('decline')}
              disabled={offerAction}
              className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {offerAction === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
              <Crown className="w-4 h-4 text-yellow-400" />
              {planLabel ? `${planLabel} plan` : 'No active plan'}
              {cancelScheduled && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/25">
                  Canceling
                </span>
              )}
            </p>
            {isManualBilling(subscription) && (
              <p className="text-xs text-cyan-300/90 mt-1">Billed directly with Simple Streamz</p>
            )}
            {plan?.monthly_price != null && (
              <p className="text-xs text-muted-foreground mt-1">
                ${Number(plan.monthly_price).toFixed(2)}/month
                {plan.max_stream_keys ? ` · ${plan.max_stream_keys} stream keys` : ''}
              </p>
            )}
            {!isAdmin && !isPaid && subscription?.trial_active && daysLeft != null && (
              <p className="text-xs text-muted-foreground mt-1">
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in free trial
              </p>
            )}
            {periodEnd && (
              <p
                className={`text-xs mt-1 ${
                  cancelScheduled ? 'text-amber-200/90' : 'text-muted-foreground'
                }`}
              >
                {periodEnd.label}{' '}
                {new Date(periodEnd.date).toLocaleDateString()}
                {cancelScheduled ? ' · You will not be charged again' : ''}
              </p>
            )}
            {!isAdmin && !enterprisePlan && (
              <button
                type="button"
                onClick={() => setProfileTab('upgrade')}
                className="text-xs text-primary hover:underline mt-2"
              >
                Change plan →
              </button>
            )}
          </div>
          {showStripeSync && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : isPaid ? 'Sync plan from Stripe' : 'Already paid? Sync from Stripe'}
            </button>
          )}
        </div>

        <div
          className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
            watermarkRequired
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
              : 'bg-green-500/10 border-green-500/20 text-green-200'
          }`}
        >
          <Droplets className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            {watermarkRequired ? (
              <>
                <p className="font-medium text-foreground">Watermark required on embeds</p>
                <p className="text-muted-foreground mt-0.5">
                  Trial and Basic plans show a watermark on playback. Upgrade to Pro to remove it.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">No watermark on embeds</p>
                <p className="text-muted-foreground mt-0.5">
                  Your plan does not require a watermark. You can still toggle watermark per embed in
                  Embed Manager.
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {showBillingControls && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Billing &amp; cancellation</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cancelScheduled
                ? 'Cancellation is scheduled in Stripe. Premium stays active until the date above. Open Stripe billing to undo cancel or update your card.'
                : manualBilling
                  ? 'Your Enterprise plan is managed in-app. Cancel anytime — no email required.'
                  : 'Cancel in-app (one step) or open Stripe to manage your card and invoices.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {stripeBilling && (
              <button
                type="button"
                onClick={handleOpenBillingPortal}
                disabled={billingAction}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {billingAction === 'portal' ? 'Opening Stripe…' : 'Manage billing on Stripe'}
              </button>
            )}
            {showCancelButton && (
              <button
                type="button"
                onClick={handleCancelPlan}
                disabled={billingAction}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {billingAction === 'cancel'
                  ? 'Canceling…'
                  : manualBilling
                    ? 'Cancel Enterprise plan'
                    : 'Cancel plan'}
              </button>
            )}
          </div>
          {stripeBilling && !cancelScheduled && (
            <p className="text-[11px] text-muted-foreground">
              Cancel plan schedules the end of your subscription — you only need to confirm once in
              the app. You do not need to cancel again in Stripe unless you prefer Stripe&apos;s
              portal.
            </p>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-card rounded-2xl border border-red-500/25 p-5 space-y-4"
      >
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            Delete account
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin
              ? 'Admin accounts must be changed by another administrator before deletion.'
              : 'Permanently remove your account, stream keys, embeds, and subscription data. Canceling a plan alone does not delete your information.'}
          </p>
        </div>
        {!isAdmin && (
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deletingAccount}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete my account
          </button>
        )}
      </motion.div>
        </TabsContent>

        <TabsContent value="upgrade" className="space-y-6 mt-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border/50 p-5 space-y-4"
          >
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Plan switcher
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isAdmin
                  ? 'Administrators have full platform access without a paid plan.'
                  : enterprisePlan
                    ? 'Enterprise plans are custom. Contact us to change limits or pricing.'
                    : isPaid
                      ? `You're on ${planLabel || 'a paid plan'}. Upgrade or downgrade anytime — we'll ask you to confirm before changing.`
                      : 'Subscribe to a paid plan, or keep using your free trial until it ends.'}
              </p>
            </div>

            {isAdmin ? (
              <p className="text-xs text-muted-foreground">
                No plan changes needed for admin accounts.
              </p>
            ) : enterprisePlan ? (
              <a
                href={enterpriseMailto('Enterprise plan change request')}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors"
              >
                Contact us about plan changes
              </a>
            ) : (
              <PlanSwitcher
                tiers={tiers}
                planLabel={planLabel}
                plan={plan}
                isPaid={isPaid}
                currentSortOrder={currentSortOrder}
                checkoutTierId={checkoutTierId}
                streamKeyCount={streamKeyCount}
                onSelectTier={handlePlanChangeRequest}
              />
            )}

            <p className="text-xs text-muted-foreground">
              Compare feature details on the{' '}
              <Link to="/pricing" className="text-primary hover:underline">
                pricing page
              </Link>
              . Stripe prorates upgrades and downgrades on your next invoice.
            </p>
          </motion.div>
        </TabsContent>
      </Tabs>

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

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        userEmail={user?.email}
        onConfirm={handleDeleteAccount}
        loading={deletingAccount}
      />
    </div>
  );
}

function PlanSwitcher({
  tiers,
  planLabel,
  plan,
  isPaid,
  currentSortOrder,
  checkoutTierId,
  streamKeyCount,
  onSelectTier,
}) {
  const paidTiers = filterSelfServeTiers(tiers);

  if (paidTiers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Pricing plans are being configured. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {paidTiers.map((tier) => {
        const action = getPlanChangeAction(tier, currentSortOrder, isPaid);
        const isCurrent = action === 'current' || planLabel === tier.name;
        const price = Number(tier.monthly_price).toFixed(2).replace(/\.00$/, '');

        return (
          <div
            key={tier.id}
            className={`rounded-xl border p-4 ${
              isCurrent
                ? 'border-primary/40 bg-primary/5'
                : 'border-border/50 bg-secondary/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{tier.name}</p>
                  {isCurrent && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/25">
                      Current plan
                    </span>
                  )}
                  {tier.is_popular && !isCurrent && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.description || ''}</p>
                <p className="text-lg font-bold text-foreground">
                  ${price}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-foreground/80">
                  <PlanFeature label={`${tier.max_stream_keys || 1} stream keys`} />
                  <PlanFeature
                    label={tier.has_watermark ? 'Watermark on embeds' : 'No watermark'}
                    muted={tier.has_watermark}
                  />
                  <PlanFeature label={`${tier.max_bitrate_mbps || '?'} Mbps bitrate`} />
                  <PlanFeature
                    label={`${(tier.max_concurrent_viewers || 0).toLocaleString()} viewers`}
                  />
                </div>
              </div>

              <div className="shrink-0">
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground border border-border/50">
                    <Check className="w-3.5 h-3.5" />
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectTier(tier)}
                    disabled={checkoutTierId === tier.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-60 ${
                      action === 'downgrade'
                        ? 'bg-secondary text-foreground border border-border hover:bg-secondary/80'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {checkoutTierId === tier.id ? (
                      'Processing…'
                    ) : action === 'subscribe' ? (
                      <>Subscribe</>
                    ) : action === 'upgrade' ? (
                      <>
                        <ArrowUp className="w-3.5 h-3.5" />
                        Upgrade
                      </>
                    ) : (
                      <>
                        <ArrowDown className="w-3.5 h-3.5" />
                        Downgrade
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-dashed border-border/80 bg-card/60 p-4">
        <p className="text-sm font-semibold text-foreground">{ENTERPRISE_PLAN.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{ENTERPRISE_PLAN.description}</p>
        <a
          href={enterpriseMailto('Enterprise plan inquiry')}
          className="inline-flex mt-3 px-3 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
        >
          Contact us for Enterprise
        </a>
      </div>
    </div>
  );
}

function PlanFeature({ label, muted = false }) {
  return (
    <span className={`flex items-center gap-1.5 ${muted ? 'text-muted-foreground' : ''}`}>
      <Check className={`w-3.5 h-3.5 shrink-0 ${muted ? 'text-muted-foreground/50' : 'text-primary'}`} />
      {label}
    </span>
  );
}
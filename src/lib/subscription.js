import { supabase } from '@/lib/supabase';
import { authJsonHeaders } from '@/lib/api-auth';
import {
  ENTERPRISE_TIER_NAME,
  hasPendingEnterpriseOffer,
} from '@/lib/enterprise';

export async function initUserSubscription() {
  const response = await fetch('/api/subscription/init', {
    method: 'POST',
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || 'Failed to initialize subscription');
    if (payload.code) error.code = payload.code;
    if (payload.trialCheck) error.trialCheck = payload.trialCheck;
    throw error;
  }

  return payload.subscription;
}

export async function fetchActiveTiers() {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchUserStreamKeys(userId) {
  const { data, error } = await supabase
    .from('stream_keys')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export async function fetchUserEmbeds(userId) {
  const { data, error } = await supabase
    .from('embed_instances')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data ?? [];
}

export function isTrialNetworkBlocked(subscription) {
  return Boolean(
    subscription?.trial_abuse_flagged &&
      !subscription?.is_paid &&
      String(subscription?.admin_notes || '').startsWith('trial_blocked:')
  );
}

export function computeTrialDaysLeft(subscription) {
  if (!subscription?.trial_active || !subscription?.trial_end_date) return null;
  const remaining = Math.ceil(
    (new Date(subscription.trial_end_date).getTime() - Date.now()) / 86400000
  );
  return Math.max(0, remaining);
}

export async function waitForSubscriptionAccess(user, { attempts = 8, delayMs = 750 } = {}) {
  let latest = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await initUserSubscription();
    const access = getSubscriptionAccess(latest, user);
    if (access.hasAccess) {
      return { subscription: latest, ...access };
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    subscription: latest,
    ...getSubscriptionAccess(latest, user),
  };
}

const PAYMENT_TIER_HINTS = [
  { amount: 99.99, name: 'Premium' },
  { amount: 29.99, name: 'Pro' },
  { amount: 9.99, name: 'Basic' },
];

export function inferTierNameFromPayment(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  const match = PAYMENT_TIER_HINTS.find((hint) => Math.abs(hint.amount - value) < 0.01);
  return match?.name ?? null;
}

async function fetchTierByName(name) {
  if (!name) return null;
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  if (!error && data) return data;
  return null;
}

export function resolveActiveTierReference(subscription) {
  if (!subscription) return { tierId: null, tierName: null };

  let tierId = subscription.subscription_tier_id || null;
  let tierName = subscription.tier_name || null;

  if (!hasPendingEnterpriseOffer(subscription)) {
    return { tierId, tierName };
  }

  const offerTierId = subscription.enterprise_offer_tier_id;
  const alreadyOnEnterprise =
    tierName === ENTERPRISE_TIER_NAME &&
    (subscription.billing_managed_by === 'manual' ||
      subscription.payment_method === 'manual_admin') &&
    tierId &&
    tierId !== offerTierId;

  if (alreadyOnEnterprise) {
    return { tierId, tierName };
  }

  if (tierId && tierId === offerTierId) {
    tierId = null;
  }
  if (tierName === ENTERPRISE_TIER_NAME) {
    tierName = null;
  }

  return { tierId, tierName };
}

export async function fetchPlanForSubscription(subscription) {
  if (!subscription) return null;

  const { tierId, tierName } = resolveActiveTierReference(subscription);

  if (tierId) {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', tierId)
      .maybeSingle();
    if (!error && data) return data;
  }

  if (tierName) {
    const tier = await fetchTierByName(tierName);
    if (tier) return tier;
  }

  const inferredName = inferTierNameFromPayment(subscription.last_payment_amount);
  if (inferredName) {
    const tier = await fetchTierByName(inferredName);
    if (tier) return tier;
  }

  if (subscription.last_payment_amount != null) {
    const amount = Number(subscription.last_payment_amount);
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('monthly_price', amount)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!error && data) return data;
  }

  return null;
}

export function getPlanLabel(subscription, user, plan = null) {
  if (plan?.name) return plan.name;
  const { tierName } = resolveActiveTierReference(subscription);
  if (tierName) return tierName;
  const inferred = inferTierNameFromPayment(subscription?.last_payment_amount);
  if (inferred) return inferred;
  if (subscription?.is_paid || subscription?.payment_status === 'subscribed') {
    return 'Paid plan';
  }
  if (user?.role === 'admin' || subscription?.payment_status === 'free_admin') {
    return 'Admin';
  }
  if (subscription?.trial_active) return 'Free trial';
  return null;
}

export function planRequiresWatermark(subscription, plan, user) {
  if (isPlatformAdmin(user, subscription)) return false;
  if (plan?.has_watermark === false) return false;
  if (plan?.has_watermark === true) return true;

  const inferred = inferTierNameFromPayment(subscription?.last_payment_amount);
  if (inferred === 'Pro' || inferred === 'Premium') return false;
  if (inferred === 'Basic') return true;

  const amount = Number(subscription?.last_payment_amount);
  if (Number.isFinite(amount) && amount >= 29.99) return false;

  return true;
}

export function resolveCurrentTierSortOrder(subscription, plan, tiers = []) {
  if (plan?.sort_order != null) return plan.sort_order;

  const { tierName } = resolveActiveTierReference(subscription);
  const label =
    plan?.name ||
    tierName ||
    inferTierNameFromPayment(subscription?.last_payment_amount);

  const matched = tiers.find((tier) => tier.name === label);
  return matched?.sort_order ?? -1;
}

export function isPlatformAdmin(user, subscription) {
  return user?.role === 'admin' || subscription?.payment_status === 'free_admin';
}

export function isManualBilling(subscription) {
  if (hasPendingEnterpriseOffer(subscription)) return false;
  return (
    subscription?.billing_managed_by === 'manual' ||
    subscription?.payment_method === 'manual_admin'
  );
}

export function usesStripeBilling(subscription, user) {
  if (isPlatformAdmin(user, subscription)) return false;
  if (subscription?.payment_status === 'free_admin') return false;
  if (isManualBilling(subscription)) return false;

  const isPaid =
    subscription?.is_paid || subscription?.payment_status === 'subscribed';
  if (!isPaid) return false;

  return (
    subscription?.payment_method === 'stripe' ||
    Boolean(subscription?.stripe_customer_id || subscription?.stripe_subscription_id)
  );
}

export function isSubscriptionCancelScheduled(subscription) {
  return Boolean(subscription?.subscription_cancel_at);
}

export function getPlanPeriodEndLabel(subscription) {
  if (isSubscriptionCancelScheduled(subscription)) {
    return {
      label: 'Access ends',
      date: subscription.subscription_cancel_at,
    };
  }
  if (subscription?.subscription_renewal_date) {
    return {
      label: 'Renews',
      date: subscription.subscription_renewal_date,
    };
  }
  return null;
}

export function canManageSubscription(subscription, user) {
  if (isPlatformAdmin(user, subscription)) return false;
  if (subscription?.payment_status === 'free_admin') return false;
  if (hasPendingEnterpriseOffer(subscription)) {
    return usesStripeBilling(subscription, user);
  }

  const isPaid =
    subscription?.is_paid || subscription?.payment_status === 'subscribed';
  if (!isPaid) return false;

  return usesStripeBilling(subscription, user) || isManualBilling(subscription);
}

export function canCancelSubscription(subscription, user) {
  if (!canManageSubscription(subscription, user)) return false;
  if (isSubscriptionCancelScheduled(subscription) && usesStripeBilling(subscription, user)) {
    return false;
  }
  return true;
}

export function needsStripeSync(user, subscription, plan = null) {
  if (isManualBilling(subscription)) return false;
  if (!subscription) return true;

  const isStripePaid =
    subscription.is_paid ||
    subscription.payment_status === 'subscribed';

  if (!isStripePaid) return true;
  if (isPlatformAdmin(user, subscription)) return false;
  if (subscription.tier_name && subscription.subscription_tier_id) return false;
  if (plan?.id) return false;
  if (inferTierNameFromPayment(subscription.last_payment_amount)) return false;
  return true;
}

export function getSubscriptionAccess(subscription, user) {
  const daysLeft = computeTrialDaysLeft(subscription);
  const isPaid =
    subscription?.is_paid ||
    subscription?.payment_status === 'free_admin' ||
    subscription?.payment_status === 'subscribed';
  const isExpired =
    subscription?.payment_status === 'unpaid_trial_expired' ||
    isTrialNetworkBlocked(subscription) ||
    (!isPaid && subscription?.trial_active === false);
  const hasAccess =
    isPaid ||
    user?.role === 'admin' ||
    (subscription?.trial_active && daysLeft > 0);

  return { daysLeft, isPaid, isExpired, hasAccess };
}
import { supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

export class SubscriptionAccessError extends Error {
  constructor(message, code = 'subscription_required') {
    super(message);
    this.code = code;
  }
}

function computeTrialDaysLeft(subscription) {
  if (!subscription?.trial_active || !subscription?.trial_end_date) return null;
  const remaining = Math.ceil(
    (new Date(subscription.trial_end_date).getTime() - Date.now()) / 86400000
  );
  return Math.max(0, remaining);
}

export function evaluateSubscriptionAccess(subscription, { isAdmin = false } = {}) {
  const daysLeft = computeTrialDaysLeft(subscription);
  const isPaid =
    subscription?.is_paid ||
    subscription?.payment_status === 'free_admin' ||
    subscription?.payment_status === 'subscribed';
  const isExpired =
    subscription?.payment_status === 'unpaid_trial_expired' ||
    subscription?.payment_status === 'canceled' ||
    (!isPaid && subscription?.trial_active === false);
  const hasAccess =
    isPaid || isAdmin || (subscription?.trial_active && daysLeft > 0);

  return { daysLeft, isPaid, isExpired, hasAccess };
}

export async function getUserSubscription(env, userId) {
  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `user_id=eq.${userId}&select=*`
  );
  return rows?.[0] ?? null;
}

export async function isUserAdmin(env, userId) {
  const rows = await supabaseSelect(env, 'profiles', `id=eq.${userId}&select=role`);
  return rows?.[0]?.role === 'admin';
}

async function expireTrialIfNeeded(env, subscription) {
  if (
    !subscription?.trial_active ||
    !subscription?.trial_end_date ||
    subscription?.is_paid ||
    subscription?.payment_status !== 'trial'
  ) {
    return subscription;
  }

  if (new Date(subscription.trial_end_date).getTime() >= Date.now()) {
    return subscription;
  }

  const updated = await supabaseUpdate(env, 'user_subscriptions', `user_id=eq.${subscription.user_id}`, {
    trial_active: false,
    payment_status: 'unpaid_trial_expired',
  });

  return updated || {
    ...subscription,
    trial_active: false,
    payment_status: 'unpaid_trial_expired',
  };
}

export async function getPlatformAccess(env, userId) {
  const [subscription, isAdmin] = await Promise.all([
    getUserSubscription(env, userId),
    isUserAdmin(env, userId),
  ]);

  const current = subscription ? await expireTrialIfNeeded(env, subscription) : null;
  const access = evaluateSubscriptionAccess(current, { isAdmin });

  return {
    subscription: current,
    isAdmin,
    ...access,
  };
}

export async function assertPlatformAccess(env, userId) {
  const access = await getPlatformAccess(env, userId);
  if (!access.hasAccess) {
    throw new SubscriptionAccessError(
      'Active subscription required. Upgrade to continue.',
      'subscription_required'
    );
  }
  return access;
}
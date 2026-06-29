import { isUserAdmin } from './admin-access.mjs';
import { assessTrialRegistration } from './trial-abuse.mjs';
import { supabaseInsert, supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

const TRIAL_DAYS = 10;

function expireTrialIfNeeded(subscription) {
  if (
    !subscription?.trial_active ||
    !subscription?.trial_end_date ||
    subscription?.is_paid ||
    subscription?.payment_status !== 'trial'
  ) {
    return subscription;
  }

  const ended = new Date(subscription.trial_end_date).getTime() < Date.now();
  if (!ended) return subscription;

  return {
    ...subscription,
    trial_active: false,
    payment_status: 'unpaid_trial_expired',
  };
}

async function persistExpiredTrial(env, subscription) {
  const normalized = expireTrialIfNeeded(subscription);
  if (normalized === subscription) return subscription;

  const updated = await supabaseUpdate(env, 'user_subscriptions', `id=eq.${subscription.id}`, {
    trial_active: false,
    payment_status: 'unpaid_trial_expired',
  });
  return updated || normalized;
}

function hasActiveStripeSubscription(subscription) {
  return (
    Boolean(subscription?.stripe_subscription_id) &&
    (subscription?.is_paid ||
      subscription?.payment_status === 'subscribed' ||
      subscription?.payment_method === 'stripe')
  );
}

async function ensureAdminFreePass(env, userId, subscription) {
  if (!subscription) return subscription;

  const isAdmin = await isUserAdmin(env, userId);
  if (!isAdmin) return subscription;

  // Keep Stripe-paid state (e.g. admin testing live checkout).
  if (hasActiveStripeSubscription(subscription)) {
    return subscription;
  }

  if (subscription.payment_status === 'free_admin' && !subscription.trial_active) {
    return subscription;
  }

  const updated = await supabaseUpdate(env, 'user_subscriptions', `user_id=eq.${userId}`, {
    trial_active: false,
    is_paid: false,
    payment_status: 'free_admin',
    payment_method: 'manual_admin',
  });

  return (
    updated || {
      ...subscription,
      trial_active: false,
      is_paid: false,
      payment_status: 'free_admin',
      payment_method: 'manual_admin',
    }
  );
}

export async function initUserSubscriptionForUser(env, { user, request }) {
  if (!user?.id) {
    throw new Error('Not authenticated');
  }

  const existingRows =
    (await supabaseSelect(
      env,
      'user_subscriptions',
      `user_id=eq.${user.id}&select=*&limit=1`
    )) ?? [];
  const existing = existingRows[0];

  if (existing) {
    const expired = await persistExpiredTrial(env, existing);
    const subscription = await ensureAdminFreePass(env, user.id, expired);
    return { subscription, created: false, trialCheck: null };
  }

  const trialCheck = await assessTrialRegistration(env, { user, request });

  if (!trialCheck.allowed) {
    const subscription = await supabaseInsert(env, 'user_subscriptions', {
      user_id: user.id,
      trial_active: false,
      trial_start_date: null,
      trial_end_date: null,
      is_paid: false,
      payment_status: 'unpaid_trial_expired',
      payment_method: 'none',
      trial_abuse_flagged: true,
      admin_notes: `trial_blocked: ${trialCheck.registrationCount}/${trialCheck.limit} trials from shared network`,
    });

    return { subscription, created: true, trialCheck, blocked: true };
  }

  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
  const subscription = await supabaseInsert(env, 'user_subscriptions', {
    user_id: user.id,
    trial_active: true,
    trial_start_date: new Date().toISOString(),
    trial_end_date: trialEnd,
    is_paid: false,
    payment_status: 'trial',
    payment_method: 'none',
    trial_abuse_flagged: trialCheck.registrationCount > 1,
  });

  return { subscription, created: true, trialCheck, blocked: false };
}
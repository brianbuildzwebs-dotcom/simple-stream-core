import { cancelActiveStripeSubscription } from './subscription-billing.mjs';
import { supabaseSelect, supabaseUpdate, upsertUserSubscription } from './supabase-admin.mjs';

export function hasEnterpriseRequest(subscription) {
  return Boolean(subscription?.enterprise_requested_at);
}

export function needsEnterpriseOfferAttention(subscription) {
  if (!hasEnterpriseRequest(subscription)) return false;
  if (subscription?.enterprise_offer_tier_id) return false;
  if (subscription?.tier_name === 'Enterprise' && subscription?.billing_managed_by === 'manual') {
    return false;
  }
  return true;
}

export function isManualBillingSubscription(subscription) {
  return (
    subscription?.billing_managed_by === 'manual' ||
    subscription?.payment_method === 'manual_admin'
  );
}

export async function getUserSubscription(env, userId) {
  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `user_id=eq.${userId}&select=*`
  );
  return rows?.[0] ?? null;
}

export async function getEnterpriseOfferForUser(env, userId) {
  const subscription = await getUserSubscription(env, userId);
  if (!subscription?.enterprise_offer_tier_id) {
    return { offer: null, subscription };
  }

  const tiers = await supabaseSelect(
    env,
    'subscription_tiers',
    `id=eq.${subscription.enterprise_offer_tier_id}&select=*`
  );
  const tier = tiers?.[0] ?? null;

  return {
    subscription,
    request: hasEnterpriseRequest(subscription)
      ? {
          requestedAt: subscription.enterprise_requested_at,
          note: subscription.enterprise_request_note || null,
          pending: needsEnterpriseOfferAttention(subscription),
        }
      : null,
    offer: tier
      ? {
          tier,
          note: subscription.enterprise_offer_note || null,
          offeredAt: subscription.enterprise_offer_at || null,
        }
      : null,
  };
}

export async function submitEnterpriseRequest(env, userId, note = '') {
  const subscription = await getUserSubscription(env, userId);
  if (subscription?.enterprise_offer_tier_id) {
    throw new Error('You already have a pending Enterprise offer on your Profile');
  }
  if (subscription?.tier_name === 'Enterprise' && isManualBillingSubscription(subscription)) {
    throw new Error('You are already on an Enterprise plan');
  }

  const updated = await upsertUserSubscription(env, userId, {
    enterprise_requested_at: new Date().toISOString(),
    enterprise_request_note: note.trim() || null,
  });

  return { subscription: updated };
}

export async function offerEnterpriseUpgrade(env, { userId, tierId, note = '' }) {
  const tiers = await supabaseSelect(env, 'subscription_tiers', `id=eq.${tierId}&select=id,name`);
  const tier = tiers?.[0];
  if (!tier) {
    throw new Error('Enterprise tier not found');
  }

  const updated = await upsertUserSubscription(env, userId, {
    enterprise_offer_tier_id: tierId,
    enterprise_offer_note: note.trim() || null,
    enterprise_offer_at: new Date().toISOString(),
  });

  return { subscription: updated, tier };
}

export async function clearEnterpriseOffer(env, userId) {
  return upsertUserSubscription(env, userId, {
    enterprise_offer_tier_id: null,
    enterprise_offer_note: null,
    enterprise_offer_at: null,
  });
}

export async function acceptEnterpriseOffer(env, userId) {
  const subscription = await getUserSubscription(env, userId);
  if (!subscription?.enterprise_offer_tier_id) {
    throw new Error('No pending Enterprise offer');
  }

  const tiers = await supabaseSelect(
    env,
    'subscription_tiers',
    `id=eq.${subscription.enterprise_offer_tier_id}&select=*`
  );
  const tier = tiers?.[0];
  if (!tier) {
    throw new Error('Offered tier is no longer available');
  }

  const updated = await upsertUserSubscription(env, userId, {
    subscription_tier_id: tier.id,
    tier_name: tier.name,
    is_paid: true,
    payment_status: 'subscribed',
    payment_method: 'manual_admin',
    billing_managed_by: 'manual',
    trial_active: false,
    subscription_start_date: new Date().toISOString(),
    last_payment_amount: tier.monthly_price > 0 ? tier.monthly_price : null,
    enterprise_offer_tier_id: null,
    enterprise_offer_note: null,
    enterprise_offer_at: null,
    enterprise_requested_at: null,
    enterprise_request_note: null,
  });

  const profiles = await supabaseSelect(env, 'profiles', `id=eq.${userId}&select=email`);
  const stripeCancel = await cancelActiveStripeSubscription(
    env,
    { id: userId, email: profiles?.[0]?.email || null },
    { immediate: true }
  ).catch(() => ({ canceled: false, reason: 'stripe_cancel_failed' }));

  return { subscription: updated, tier, stripeSubscriptionCanceled: Boolean(stripeCancel.canceled) };
}

export async function declineEnterpriseOffer(env, userId) {
  const subscription = await getUserSubscription(env, userId);
  if (!subscription?.enterprise_offer_tier_id) {
    throw new Error('No pending Enterprise offer');
  }
  const updated = await clearEnterpriseOffer(env, userId);
  return { subscription: updated };
}
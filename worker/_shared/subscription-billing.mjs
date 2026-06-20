import { normalizeStripeSecretKey } from './stripe-secrets.mjs';
import { supabaseSelect, upsertUserSubscription } from './supabase-admin.mjs';

function isManualBillingSubscription(subscription) {
  return (
    subscription?.billing_managed_by === 'manual' ||
    subscription?.payment_method === 'manual_admin'
  );
}

function normalizeStripeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.id === 'string') return value.id;
  return null;
}

async function stripeRequest(stripeKey, path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe request failed: ${path}`);
  }
  return payload;
}

async function getUserSubscription(env, userId) {
  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `user_id=eq.${userId}&select=*`
  );
  return rows?.[0] ?? null;
}

async function findStripeCustomerId(stripeKey, user, existingCustomerId = null) {
  if (existingCustomerId) return existingCustomerId;
  if (!user.email) return null;

  const customers = await stripeRequest(
    stripeKey,
    `/customers?email=${encodeURIComponent(user.email)}&limit=1`
  );
  return customers?.data?.[0]?.id ?? null;
}

async function findActiveStripeSubscription(stripeKey, customerId) {
  if (!customerId) return null;

  const subscriptions = await stripeRequest(
    stripeKey,
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=10`
  );
  return (
    subscriptions?.data?.find((item) => ['active', 'trialing'].includes(item.status)) ?? null
  );
}

async function resolveStripeSubscription(stripeKey, user, subscription) {
  const subscriptionId = normalizeStripeId(subscription?.stripe_subscription_id);
  if (subscriptionId) {
    try {
      const stripeSub = await stripeRequest(stripeKey, `/subscriptions/${subscriptionId}`);
      if (['active', 'trialing', 'past_due'].includes(stripeSub?.status)) {
        return stripeSub;
      }
    } catch {
      // Fall through to customer lookup.
    }
  }

  const customerId = await findStripeCustomerId(
    stripeKey,
    user,
    subscription?.stripe_customer_id
  );
  return findActiveStripeSubscription(stripeKey, customerId);
}

export async function createBillingPortalSession(user, env, returnUrl) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    throw new Error('Stripe is not configured');
  }

  const subscription = await getUserSubscription(env, user.id);
  if (!subscription) {
    throw new Error('No subscription found');
  }
  if (isManualBillingSubscription(subscription)) {
    throw new Error('Your plan is billed directly with Simple Streamz. Use Cancel plan on Profile.');
  }
  if (subscription.payment_status === 'free_admin') {
    throw new Error('Admin accounts cannot manage billing here');
  }

  const customerId = await findStripeCustomerId(
    stripeKey,
    user,
    subscription.stripe_customer_id
  );
  if (!customerId) {
    throw new Error('No Stripe billing profile found for this account');
  }

  const session = await stripeRequest(stripeKey, '/billing_portal/sessions', {
    method: 'POST',
    body: {
      customer: customerId,
      return_url: returnUrl,
    },
  });

  if (!session?.url) {
    throw new Error('Billing portal session missing redirect URL');
  }

  return { url: session.url };
}

async function cancelManualSubscription(env, userId, user = null) {
  if (user?.id === userId) {
    await cancelActiveStripeSubscription(env, user, { immediate: true }).catch(() => null);
  } else {
    const profiles = await supabaseSelect(env, 'profiles', `id=eq.${userId}&select=email`);
    await cancelActiveStripeSubscription(
      env,
      { id: userId, email: profiles?.[0]?.email || null },
      { immediate: true }
    ).catch(() => null);
  }

  const updated = await upsertUserSubscription(env, userId, {
    is_paid: false,
    payment_status: 'canceled',
    trial_active: false,
    payment_method: 'none',
    billing_managed_by: 'stripe',
    subscription_tier_id: null,
    tier_name: null,
    last_payment_amount: null,
    subscription_renewal_date: null,
    subscription_cancel_at: null,
    enterprise_requested_at: null,
    enterprise_request_note: null,
    enterprise_offer_tier_id: null,
    enterprise_offer_note: null,
    enterprise_offer_at: null,
  });

  return {
    canceled: true,
    mode: 'manual',
    immediate: true,
    subscription: updated,
  };
}

export async function cancelActiveStripeSubscription(env, user, { immediate = false } = {}) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    return { canceled: false, reason: 'stripe_not_configured' };
  }

  const subscription = await getUserSubscription(env, user.id);
  if (!subscription) {
    return { canceled: false, reason: 'no_subscription' };
  }

  const stripeSubscription = await resolveStripeSubscription(stripeKey, user, subscription);
  if (!stripeSubscription?.id) {
    return { canceled: false, reason: 'no_stripe_subscription' };
  }

  if (immediate) {
    await stripeRequest(stripeKey, `/subscriptions/${stripeSubscription.id}`, {
      method: 'DELETE',
    });
    return {
      canceled: true,
      mode: 'stripe',
      immediate: true,
      stripeSubscriptionId: stripeSubscription.id,
    };
  }

  const updatedStripeSub = await stripeRequest(
    stripeKey,
    `/subscriptions/${stripeSubscription.id}`,
    {
      method: 'POST',
      body: { cancel_at_period_end: 'true' },
    }
  );

  const cancelAt = updatedStripeSub?.cancel_at
    ? new Date(updatedStripeSub.cancel_at * 1000).toISOString()
    : updatedStripeSub?.current_period_end
      ? new Date(updatedStripeSub.current_period_end * 1000).toISOString()
      : null;

  if (cancelAt) {
    await upsertUserSubscription(env, user.id, {
      subscription_renewal_date: cancelAt,
      subscription_cancel_at: cancelAt,
    });
  }

  return {
    canceled: true,
    mode: 'stripe',
    immediate: false,
    cancelAt,
    stripeSubscriptionId: stripeSubscription.id,
  };
}

export async function cancelUserSubscription(user, env, { immediate = false } = {}) {
  const subscription = await getUserSubscription(env, user.id);
  if (!subscription) {
    throw new Error('No subscription found');
  }

  if (subscription.payment_status === 'free_admin') {
    throw new Error('Admin-granted access cannot be canceled here');
  }

  const isPaid =
    subscription.is_paid ||
    subscription.payment_status === 'subscribed';

  if (!isPaid) {
    throw new Error('You do not have an active paid plan to cancel');
  }

  if (isManualBillingSubscription(subscription)) {
    return cancelManualSubscription(env, user.id, user);
  }

  const stripeResult = await cancelActiveStripeSubscription(env, user, { immediate });
  if (!stripeResult.canceled) {
    throw new Error(
      'No Stripe subscription was found. Try Manage billing, or contact support if you were charged recently.'
    );
  }

  if (stripeResult.immediate) {
    const updated = await upsertUserSubscription(env, user.id, {
      is_paid: false,
      payment_status: 'canceled',
      trial_active: false,
      subscription_cancel_at: null,
      subscription_renewal_date: null,
    });
    return { ...stripeResult, subscription: updated };
  }

  const current = await getUserSubscription(env, user.id);
  return { ...stripeResult, subscription: current };
}
import { isManualBillingSubscription } from './enterprise-offers.mjs';
import { normalizeStripeSecretKey } from './stripe-secrets.mjs';
import { supabaseSelect, supabaseUpdate, upsertUserSubscription } from './supabase-admin.mjs';

function normalizeStripeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && typeof value.id === 'string') return value.id;
  return null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function parseStripeSignature(header) {
  const parsed = { timestamp: null, signatures: [] };
  if (!header) return parsed;

  for (const part of header.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') parsed.timestamp = value;
    if (key === 'v1' && value) parsed.signatures.push(value);
  }

  return parsed;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyStripeWebhookSignature(payload, signatureHeader, secret) {
  if (!secret || !signatureHeader || !payload) return false;

  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = bytesToHex(new Uint8Array(mac));

  return signatures.some((signature) => timingSafeEqual(expected, signature));
}

async function fetchStripeSubscription(subscriptionId, env) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  if (!subscriptionId || !stripeKey) return null;

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });

  if (!response.ok) return null;
  return response.json();
}

function renewalDateFromSubscription(subscription) {
  const periodEnd = subscription?.current_period_end;
  if (!periodEnd) return null;
  return new Date(periodEnd * 1000).toISOString();
}

export function scheduledCancelAtFromStripeSubscription(stripeSubscription) {
  if (!stripeSubscription?.cancel_at_period_end) return null;
  const unix = stripeSubscription.cancel_at || stripeSubscription.current_period_end;
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

async function resolveTierFromStripe(env, stripeSubscription, hints = {}) {
  const metaTierId = hints.tierId || stripeSubscription?.metadata?.tier_id;
  const metaTierName = hints.tierName || stripeSubscription?.metadata?.tier_name;

  if (isUuid(metaTierId)) {
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `id=eq.${metaTierId}&select=id,name,max_stream_keys,monthly_price`
    );
    if (tiers?.[0]) return tiers[0];
  }

  if (metaTierName) {
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `name=eq.${encodeURIComponent(metaTierName)}&select=id,name,max_stream_keys,monthly_price`
    );
    if (tiers?.[0]) return tiers[0];
  }

  const price = stripeSubscription?.items?.data?.[0]?.price;
  const priceId = price?.id;
  if (priceId) {
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `stripe_price_id=eq.${encodeURIComponent(priceId)}&select=id,name,max_stream_keys,monthly_price`
    );
    if (tiers?.[0]) return tiers[0];
  }

  const unitAmount = price?.unit_amount;
  if (unitAmount != null) {
    const monthlyPrice = Math.round(Number(unitAmount)) / 100;
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `monthly_price=eq.${monthlyPrice}&select=id,name,max_stream_keys,monthly_price&order=sort_order.asc&limit=1`
    );
    if (tiers?.[0]) return tiers[0];
  }

  return null;
}

async function findStripeCustomerId(stripeKey, user, existingCustomerId = null) {
  if (existingCustomerId) return existingCustomerId;
  if (!user.email) return null;

  const customers = await stripeGet(
    stripeKey,
    `/customers?email=${encodeURIComponent(user.email)}&limit=1`
  );
  return customers?.data?.[0]?.id ?? null;
}

async function findActiveStripeSubscription(stripeKey, customerId) {
  if (!customerId) return null;

  const subscriptions = await stripeGet(
    stripeKey,
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=10`
  );
  return (
    subscriptions?.data?.find((item) => ['active', 'trialing'].includes(item.status)) ?? null
  );
}

async function activatePaidSubscription(env, {
  userId,
  tierId,
  tierName,
  stripeCustomerId,
  stripeSubscriptionId,
  amount,
  renewalDate,
  cancelAt,
}) {
  if (!userId) {
    throw new Error('Stripe activation missing user_id');
  }

  const customerId = normalizeStripeId(stripeCustomerId);
  const subscriptionId = normalizeStripeId(stripeSubscriptionId);

  const patch = {
    is_paid: true,
    payment_status: 'subscribed',
    payment_method: 'stripe',
    billing_managed_by: 'stripe',
    trial_active: false,
    subscription_start_date: new Date().toISOString(),
  };

  if (tierId && isUuid(tierId)) patch.subscription_tier_id = tierId;
  if (tierName) patch.tier_name = tierName;
  if (customerId) patch.stripe_customer_id = customerId;
  if (subscriptionId) patch.stripe_subscription_id = subscriptionId;
  if (amount != null) patch.last_payment_amount = amount;
  if (renewalDate) patch.subscription_renewal_date = renewalDate;
  patch.subscription_cancel_at = cancelAt || null;

  const saved = await upsertUserSubscription(env, userId, patch);
  if (!saved?.is_paid) {
    throw new Error('Failed to persist paid subscription');
  }

  return saved;
}

async function markSubscriptionCanceled(env, stripeSubscriptionId) {
  if (!stripeSubscriptionId) return;

  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}&select=user_id,billing_managed_by,payment_method`
  );

  const existing = rows?.[0];
  if (!existing?.user_id || isManualBillingSubscription(existing)) return;

  await upsertUserSubscription(env, existing.user_id, {
    is_paid: false,
    payment_status: 'canceled',
    trial_active: false,
  });
}

export async function activateFromCheckoutSession(session, env) {
  if (session.mode !== 'subscription') return;

  const userId = session.metadata?.user_id || session.client_reference_id;
  const tierId = session.metadata?.tier_id;
  const tierName = session.metadata?.tier_name;
  const stripeSubscriptionId = normalizeStripeId(session.subscription);
  const stripeCustomerId = normalizeStripeId(session.customer);
  const amount = session.amount_total != null ? session.amount_total / 100 : null;

  const stripeSubscription = await fetchStripeSubscription(stripeSubscriptionId, env);
  const tier = stripeSubscription
    ? await resolveTierFromStripe(env, stripeSubscription, { tierId, tierName })
    : null;

  return activatePaidSubscription(env, {
    userId,
    tierId: tier?.id || tierId || stripeSubscription?.metadata?.tier_id,
    tierName: tier?.name || tierName || stripeSubscription?.metadata?.tier_name,
    stripeCustomerId,
    stripeSubscriptionId,
    amount: amount ?? tier?.monthly_price ?? null,
    renewalDate: renewalDateFromSubscription(stripeSubscription),
  });
}

async function stripeGet(stripeKey, path) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe request failed: ${path}`);
  }
  return payload;
}

async function stripePost(stripeKey, path, body) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe request failed: ${path}`);
  }
  return payload;
}

async function stripeDelete(stripeKey, path) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe request failed: ${path}`);
  }
  return payload;
}

async function listActiveStripeSubscriptions(stripeKey, customerId) {
  if (!customerId) return [];

  const subscriptions = await stripeGet(
    stripeKey,
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=20`
  );
  return (
    subscriptions?.data?.filter((item) => ['active', 'trialing'].includes(item.status)) ?? []
  );
}

async function resolveStripePriceForTier(stripeKey, tier) {
  if (tier.stripe_price_id) return tier.stripe_price_id;

  const amount = Math.round(Number(tier.monthly_price) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('This plan does not have a valid Stripe price');
  }

  const price = await stripePost(stripeKey, '/prices', {
    currency: 'usd',
    unit_amount: String(amount),
    'recurring[interval]': 'month',
    'product_data[name]': `${tier.name} — Simple Streamz`,
  });
  return price.id;
}

async function resolveTierSortOrder(env, { tierId, tierName, fallback = -1 } = {}) {
  if (tierId && isUuid(tierId)) {
    const rows = await supabaseSelect(
      env,
      'subscription_tiers',
      `id=eq.${tierId}&select=sort_order`
    );
    if (rows?.[0]?.sort_order != null) return rows[0].sort_order;
  }

  if (tierName) {
    const rows = await supabaseSelect(
      env,
      'subscription_tiers',
      `name=eq.${encodeURIComponent(tierName)}&select=sort_order`
    );
    if (rows?.[0]?.sort_order != null) return rows[0].sort_order;
  }

  return fallback;
}

async function cancelOtherActiveSubscriptions(stripeKey, customerId, keepSubscriptionId) {
  const subs = await listActiveStripeSubscriptions(stripeKey, customerId);
  for (const sub of subs) {
    if (sub.id !== keepSubscriptionId) {
      await stripeDelete(stripeKey, `/subscriptions/${sub.id}`);
    }
  }
}

export async function tryUpgradeStripeSubscription(env, user, targetTier) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    return { upgraded: false, reason: 'stripe_not_configured' };
  }

  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `user_id=eq.${user.id}&select=*`
  );
  const existing = rows?.[0];

  if (isManualBillingSubscription(existing)) {
    return { upgraded: false, reason: 'manual_billing' };
  }

  const customerId = await findStripeCustomerId(stripeKey, user, existing?.stripe_customer_id);
  if (!customerId) {
    return { upgraded: false, reason: 'no_customer' };
  }

  const activeSubs = await listActiveStripeSubscriptions(stripeKey, customerId);
  const primarySub =
    activeSubs.find((sub) => sub.id === existing?.stripe_subscription_id) || activeSubs[0];

  if (!primarySub?.id) {
    return { upgraded: false, reason: 'no_active_subscription' };
  }

  const currentSort = await resolveTierSortOrder(env, {
    tierId: existing?.subscription_tier_id,
    tierName: existing?.tier_name,
  });
  const targetSort =
    targetTier.sort_order ??
    (await resolveTierSortOrder(env, {
      tierId: targetTier.id,
      tierName: targetTier.name,
    }));

  if (targetSort === currentSort) {
    throw new Error('You are already on this plan.');
  }

  const itemId = primarySub.items?.data?.[0]?.id;
  if (!itemId) {
    throw new Error('Stripe subscription is missing a billable item');
  }

  const priceId = await resolveStripePriceForTier(stripeKey, targetTier);

  const updated = await stripePost(stripeKey, `/subscriptions/${primarySub.id}`, {
    'items[0][id]': itemId,
    'items[0][price]': priceId,
    proration_behavior: 'create_prorations',
    'metadata[tier_id]': targetTier.id,
    'metadata[tier_name]': targetTier.name,
    'metadata[user_id]': user.id,
  });

  let finalSub = updated;
  if (updated.cancel_at_period_end) {
    finalSub = await stripePost(stripeKey, `/subscriptions/${updated.id}`, {
      cancel_at_period_end: 'false',
    });
  }

  await cancelOtherActiveSubscriptions(stripeKey, customerId, finalSub.id);

  const saved = await activatePaidSubscription(env, {
    userId: user.id,
    tierId: targetTier.id,
    tierName: targetTier.name,
    stripeCustomerId: customerId,
    stripeSubscriptionId: finalSub.id,
    amount: targetTier.monthly_price,
    renewalDate: renewalDateFromSubscription(finalSub),
    cancelAt: null,
  });

  return {
    upgraded: true,
    subscription: saved,
    tierName: targetTier.name,
  };
}

function isPaidCheckoutSession(session, userId) {
  return (
    (session.client_reference_id === userId || session.metadata?.user_id === userId) &&
    session.status === 'complete' &&
    session.mode === 'subscription' &&
    session.payment_status === 'paid'
  );
}

async function listCheckoutSessions(stripeKey, { customerId, startingAfter } = {}) {
  const params = new URLSearchParams({ limit: '100' });
  if (customerId) params.set('customer', customerId);
  if (startingAfter) params.set('starting_after', startingAfter);
  return stripeGet(stripeKey, `/checkout/sessions?${params.toString()}`);
}

async function findCompletedCheckoutSession(stripeKey, userId, customerId = null) {
  const scopes = customerId ? [customerId, null] : [null];

  for (const scopedCustomerId of scopes) {
    let startingAfter = null;

    for (let page = 0; page < 5; page += 1) {
      const result = await listCheckoutSessions(stripeKey, {
        customerId: scopedCustomerId,
        startingAfter,
      });
      const session = result?.data?.find((item) => isPaidCheckoutSession(item, userId));
      if (session) return session;

      if (!result?.has_more || !result.data?.length) break;
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  return null;
}

export async function syncUserSubscriptionFromStripe(user, env) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    throw new Error('Stripe is not configured');
  }

  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `user_id=eq.${user.id}&select=*`
  );
  const existing = rows?.[0];
  const alreadyPaid = existing?.is_paid || existing?.payment_status === 'subscribed';

  if (isManualBillingSubscription(existing)) {
    return {
      synced: false,
      skipped: true,
      reason: 'manual_billing',
      subscription: existing,
      alreadyActive: alreadyPaid,
    };
  }

  const customerId = await findStripeCustomerId(
    stripeKey,
    user,
    existing?.stripe_customer_id
  );

  const stripeSubscription = await findActiveStripeSubscription(stripeKey, customerId);
  if (stripeSubscription) {
    const tier = await resolveTierFromStripe(env, stripeSubscription, {
      tierId: stripeSubscription.metadata?.tier_id || existing?.subscription_tier_id,
      tierName: stripeSubscription.metadata?.tier_name || existing?.tier_name,
    });
    const saved = await activatePaidSubscription(env, {
      userId: user.id,
      tierId: tier?.id || stripeSubscription.metadata?.tier_id || existing?.subscription_tier_id,
      tierName: tier?.name || stripeSubscription.metadata?.tier_name || existing?.tier_name,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSubscription.id,
      amount: tier?.monthly_price ?? null,
      renewalDate: renewalDateFromSubscription(stripeSubscription),
      cancelAt: scheduledCancelAtFromStripeSubscription(stripeSubscription),
    });
    const tierUpdated =
      Boolean(tier?.id || tier?.name) &&
      (existing?.subscription_tier_id !== saved?.subscription_tier_id ||
        existing?.tier_name !== saved?.tier_name);
    return {
      synced: true,
      source: 'subscription',
      subscription: saved,
      tierUpdated,
      alreadyActive: alreadyPaid && !tierUpdated,
    };
  }

  if (alreadyPaid) {
    return { synced: true, alreadyActive: true, subscription: existing };
  }

  const checkoutSession = await findCompletedCheckoutSession(stripeKey, user.id, customerId);
  if (checkoutSession) {
    const saved = await activateFromCheckoutSession(checkoutSession, env);
    return { synced: true, source: 'checkout_session', subscription: saved };
  }

  return { synced: false, reason: customerId ? 'no_active_subscription' : 'no_customer' };
}

async function handleSubscriptionUpdated(subscription, env) {
  const userId = subscription.metadata?.user_id;
  if (userId) {
    const rows = await supabaseSelect(
      env,
      'user_subscriptions',
      `user_id=eq.${userId}&select=billing_managed_by,payment_method`
    );
    if (isManualBillingSubscription(rows?.[0])) {
      return;
    }
  }

  const tier = await resolveTierFromStripe(env, subscription);
  const tierId = tier?.id || subscription.metadata?.tier_id;
  const tierName = tier?.name || subscription.metadata?.tier_name;
  const status = subscription.status;
  const renewalDate = renewalDateFromSubscription(subscription);

  if (['active', 'trialing'].includes(status)) {
    await activatePaidSubscription(env, {
      userId,
      tierId,
      tierName,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      renewalDate,
      cancelAt: scheduledCancelAtFromStripeSubscription(subscription),
    });
    return;
  }

  if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
    if (userId) {
      await upsertUserSubscription(env, userId, {
        is_paid: false,
        payment_status: 'canceled',
        trial_active: false,
        stripe_subscription_id: subscription.id,
        subscription_cancel_at: null,
        subscription_renewal_date: null,
      });
      return;
    }

    await markSubscriptionCanceled(env, subscription.id);
  }
}

async function handleSubscriptionDeleted(subscription, env) {
  const userId = subscription.metadata?.user_id;
  if (userId) {
    const rows = await supabaseSelect(
      env,
      'user_subscriptions',
      `user_id=eq.${userId}&select=billing_managed_by,payment_method`
    );
    if (isManualBillingSubscription(rows?.[0])) {
      return;
    }

    await upsertUserSubscription(env, userId, {
      is_paid: false,
      payment_status: 'canceled',
      trial_active: false,
      stripe_subscription_id: subscription.id,
      subscription_cancel_at: null,
      subscription_renewal_date: null,
    });
    return;
  }

  await markSubscriptionCanceled(env, subscription.id);
}

export async function handleStripeWebhookEvent(event, env) {
  switch (event.type) {
    case 'checkout.session.completed':
      await activateFromCheckoutSession(event.data.object, env);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    default:
      break;
  }
}
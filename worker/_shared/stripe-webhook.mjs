import { supabaseSelect, upsertUserSubscription } from './supabase-admin.mjs';

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
  if (!subscriptionId || !env.STRIPE_SECRET_KEY) return null;

  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });

  if (!response.ok) return null;
  return response.json();
}

function renewalDateFromSubscription(subscription) {
  const periodEnd = subscription?.current_period_end;
  if (!periodEnd) return null;
  return new Date(periodEnd * 1000).toISOString();
}

async function activatePaidSubscription(env, {
  userId,
  tierId,
  tierName,
  stripeCustomerId,
  stripeSubscriptionId,
  amount,
  renewalDate,
}) {
  if (!userId) return;

  const patch = {
    is_paid: true,
    payment_status: 'subscribed',
    payment_method: 'stripe',
    trial_active: false,
    subscription_start_date: new Date().toISOString(),
  };

  if (tierId) patch.subscription_tier_id = tierId;
  if (tierName) patch.tier_name = tierName;
  if (stripeCustomerId) patch.stripe_customer_id = stripeCustomerId;
  if (stripeSubscriptionId) patch.stripe_subscription_id = stripeSubscriptionId;
  if (amount != null) patch.last_payment_amount = amount;
  if (renewalDate) patch.subscription_renewal_date = renewalDate;

  await upsertUserSubscription(env, userId, patch);
}

async function markSubscriptionCanceled(env, stripeSubscriptionId) {
  if (!stripeSubscriptionId) return;

  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}&select=user_id`
  );

  const userId = rows?.[0]?.user_id;
  if (!userId) return;

  await upsertUserSubscription(env, userId, {
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
  const stripeSubscriptionId = session.subscription;
  const stripeCustomerId = session.customer;
  const amount = session.amount_total != null ? session.amount_total / 100 : null;

  const stripeSubscription = await fetchStripeSubscription(stripeSubscriptionId, env);

  await activatePaidSubscription(env, {
    userId,
    tierId: tierId || stripeSubscription?.metadata?.tier_id,
    tierName: tierName || stripeSubscription?.metadata?.tier_name,
    stripeCustomerId,
    stripeSubscriptionId,
    amount,
    renewalDate: renewalDateFromSubscription(stripeSubscription),
  });
}

async function handleSubscriptionUpdated(subscription, env) {
  const userId = subscription.metadata?.user_id;
  const tierId = subscription.metadata?.tier_id;
  const tierName = subscription.metadata?.tier_name;
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
      });
      return;
    }

    await markSubscriptionCanceled(env, subscription.id);
  }
}

async function handleSubscriptionDeleted(subscription, env) {
  const userId = subscription.metadata?.user_id;
  if (userId) {
    await upsertUserSubscription(env, userId, {
      is_paid: false,
      payment_status: 'canceled',
      trial_active: false,
      stripe_subscription_id: subscription.id,
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
import { upsertUserSubscription } from './supabase-admin.mjs';

function isResourceMissing(payload) {
  const code = payload?.error?.code;
  return code === 'resource_missing';
}

async function stripeGet(stripeKey, path) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Stripe request failed: ${path}`);
    error.code = payload.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function stripeCustomerExists(stripeKey, customerId) {
  if (!customerId) return false;

  try {
    const customer = await stripeGet(stripeKey, `/customers/${encodeURIComponent(customerId)}`);
    return !customer?.deleted;
  } catch (error) {
    if (error.code === 'resource_missing' || error.status === 404) return false;
    throw error;
  }
}

export async function stripeSubscriptionExists(stripeKey, subscriptionId) {
  if (!subscriptionId) return false;

  try {
    await stripeGet(stripeKey, `/subscriptions/${encodeURIComponent(subscriptionId)}`);
    return true;
  } catch (error) {
    if (error.code === 'resource_missing' || error.status === 404) return false;
    throw error;
  }
}

export async function findActiveStripeSubscriptionForCustomer(stripeKey, customerId) {
  if (!customerId) return null;

  try {
    const subscriptions = await stripeGet(
      stripeKey,
      `/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=10`
    );
    return (
      subscriptions?.data?.find((item) => ['active', 'trialing'].includes(item.status)) ?? null
    );
  } catch (error) {
    if (error.code === 'resource_missing' || error.status === 404) return null;
    throw error;
  }
}

export async function listStripeCustomersByEmail(stripeKey, email) {
  if (!email) return [];

  const normalizedEmail = String(email).trim().toLowerCase();
  const seen = new Set();
  const customers = [];

  try {
    const listed = await stripeGet(
      stripeKey,
      `/customers?email=${encodeURIComponent(normalizedEmail)}&limit=100`
    );
    for (const customer of listed?.data ?? []) {
      if (!customer?.id || customer.deleted || seen.has(customer.id)) continue;
      seen.add(customer.id);
      customers.push(customer);
    }
  } catch {
    // Ignore list failures.
  }

  return customers;
}

/**
 * Resolve a Stripe customer ID that actually exists in the current Stripe account/mode.
 * Never returns a deleted test-mode ID that only lives in our database.
 */
export async function resolveStripeCustomerId(
  stripeKey,
  user,
  storedCustomerId = null,
  { allowInactiveCustomer = false } = {}
) {
  const stale = {
    customerId: null,
    subscriptionId: null,
  };

  if (storedCustomerId && !(await stripeCustomerExists(stripeKey, storedCustomerId))) {
    stale.customerId = storedCustomerId;
  }

  const candidates = [];
  if (storedCustomerId && !stale.customerId) {
    candidates.push(storedCustomerId);
  }

  for (const customer of await listStripeCustomersByEmail(stripeKey, user?.email)) {
    if (!candidates.includes(customer.id)) {
      candidates.push(customer.id);
    }
  }

  for (const customerId of candidates) {
    const activeSub = await findActiveStripeSubscriptionForCustomer(stripeKey, customerId);
    if (activeSub) {
      return { customerId, stale };
    }
  }

  if (allowInactiveCustomer && candidates.length) {
    return { customerId: candidates[0], stale };
  }

  return { customerId: null, stale };
}

export async function clearStaleStripeBillingIds(env, userId, storedSubscription, stale = {}) {
  const patch = {};

  if (stale.customerId) {
    patch.stripe_customer_id = null;
  }

  const storedSubscriptionId = storedSubscription?.stripe_subscription_id;
  if (storedSubscriptionId && stale.subscriptionId === storedSubscriptionId) {
    patch.stripe_subscription_id = null;
  } else if (storedSubscriptionId && stale.customerId) {
    // Customer ID came from test mode; the paired subscription ID is unreliable too.
    patch.stripe_subscription_id = null;
  }

  if (!Object.keys(patch).length) return null;
  return upsertUserSubscription(env, userId, patch);
}

export function resolveBillingReturnUrl(request, env, bodyReturnUrl) {
  const appOrigin = env.PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  const fallbackOrigin = appOrigin || new URL(request.url).origin;
  const requested = String(bodyReturnUrl || '').trim();

  if (!requested) {
    return `${fallbackOrigin}/dashboard/profile?billing=return`;
  }

  try {
    const hostname = new URL(requested).hostname;
    if (appOrigin && /\.workers\.dev$/i.test(hostname)) {
      return `${fallbackOrigin}/dashboard/profile?billing=return`;
    }
  } catch {
    return `${fallbackOrigin}/dashboard/profile?billing=return`;
  }

  return requested;
}
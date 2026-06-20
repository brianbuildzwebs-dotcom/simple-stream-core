import { authJsonHeaders } from '@/lib/api-auth';

export async function createCheckoutSession(tierId, { successUrl, cancelUrl } = {}) {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({
      tierId,
      successUrl:
        successUrl ||
        `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: cancelUrl || `${window.location.origin}/pricing?checkout=canceled`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to start checkout');
  }

  if (payload.upgraded) {
    return payload;
  }

  if (!payload.url) {
    throw new Error('Checkout session missing redirect URL');
  }

  window.location.href = payload.url;
}

export async function syncStripeSubscription() {
  const response = await fetch('/api/stripe/sync', {
    method: 'POST',
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to sync subscription');
  }
  return payload;
}

export async function openBillingPortal(returnUrl) {
  const response = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({
      returnUrl:
        returnUrl ||
        `${window.location.origin}/dashboard/profile?billing=return`,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to open billing portal');
  }
  if (!payload.url) {
    throw new Error('Billing portal missing redirect URL');
  }
  window.location.href = payload.url;
}

export async function cancelSubscription({ immediate = false } = {}) {
  const response = await fetch('/api/subscription/cancel', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({ immediate }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to cancel subscription');
  }
  return payload;
}

export async function confirmCheckoutSession(sessionId) {
  const response = await fetch('/api/stripe/confirm', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to confirm checkout');
  }
  return payload;
}
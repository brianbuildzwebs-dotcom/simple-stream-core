import { authJsonHeaders } from '@/lib/api-auth';

export async function createCheckoutSession(tierId) {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({
      tierId,
      successUrl: `${window.location.origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/pricing?checkout=canceled`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to start checkout');
  }

  if (!payload.url) {
    throw new Error('Checkout session missing redirect URL');
  }

  window.location.href = payload.url;
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
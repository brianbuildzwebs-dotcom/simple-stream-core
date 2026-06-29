import { authJsonHeaders } from '@/lib/api-auth';

function handleSubscriptionRequired(response, payload) {
  if (response.status === 402 && payload.code === 'subscription_required') {
    window.location.assign('/paywall');
    throw new Error(payload.error || 'Subscription required');
  }
}

export async function fetchServiceSchedule() {
  const response = await fetch('/api/service-schedule', {
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load service schedule');
  }
  return payload;
}

export async function saveServiceSchedule(body) {
  const response = await fetch('/api/service-schedule', {
    method: 'PUT',
    headers: await authJsonHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to save service schedule');
  }
  return payload;
}
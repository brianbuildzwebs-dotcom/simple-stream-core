import { authJsonHeaders } from '@/lib/api-auth';

export async function fetchStreamAlerts({ limit = 10 } = {}) {
  const response = await fetch(`/api/stream-alerts?limit=${limit}`, {
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load stream alerts');
  }
  return payload;
}

export async function markStreamAlertsRead(alertIds = null) {
  const response = await fetch('/api/stream-alerts', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify(alertIds?.length ? { alertIds } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to update stream alerts');
  }
  return payload;
}
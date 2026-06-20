import { authJsonHeaders } from '@/lib/api-auth';

export async function submitEnterpriseRequest(note = '') {
  const response = await fetch('/api/enterprise-request', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({ note }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to submit Enterprise request');
  }
  return payload;
}

export async function fetchEnterpriseOffer() {
  const response = await fetch('/api/enterprise-offer', {
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load Enterprise offer');
  }
  return payload;
}

export async function respondToEnterpriseOffer(action) {
  const response = await fetch('/api/enterprise-offer', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({ action }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to update Enterprise offer');
  }
  return payload;
}
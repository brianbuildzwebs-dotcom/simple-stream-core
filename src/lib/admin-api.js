import { authJsonHeaders } from '@/lib/api-auth';

async function adminFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(await authJsonHeaders()),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Admin request failed');
  }
  return payload;
}

export function fetchAdminStats() {
  return adminFetch('/api/admin/stats');
}

export function fetchAdminUsers() {
  return adminFetch('/api/admin/users');
}

export function fetchAdminLegalAcceptance({ status = 'all', email = '', userId = '', limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (email) params.set('email', email);
  if (userId) params.set('userId', userId);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return adminFetch(`/api/admin/legal-acceptance${query ? `?${query}` : ''}`);
}

export function offerEnterpriseUpgrade({ userId, tierId, note }) {
  return adminFetch('/api/admin/enterprise-offer', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      tier_id: tierId,
      note: note || '',
      action: 'offer',
    }),
  });
}

export function cancelEnterpriseOffer(userId) {
  return adminFetch('/api/admin/enterprise-offer', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      action: 'cancel',
    }),
  });
}
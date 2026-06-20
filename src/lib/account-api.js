import { authJsonHeaders } from '@/lib/api-auth';

export async function deleteAccount({ confirmPhrase }) {
  const response = await fetch('/api/account/delete', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({ confirmPhrase }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to delete account');
  }

  return payload;
}
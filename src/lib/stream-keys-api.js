import { supabase } from '@/lib/supabase';
import { authJsonHeaders } from '@/lib/api-auth';

function handleSubscriptionRequired(response, payload) {
  if (response.status === 402 && payload.code === 'subscription_required') {
    window.location.assign('/paywall');
    throw new Error(payload.error || 'Subscription required');
  }
}

export async function fetchStreamKeys() {
  const response = await fetch('/api/stream-keys', {
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to load stream keys');
  }
  return payload.stream_keys ?? [];
}

export async function createStreamKey(streamName) {
  const response = await fetch('/api/stream-keys', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({ stream_name: streamName }),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to create stream key');
  }
  return payload.stream_key;
}

export async function refreshStreamKey(id) {
  const response = await fetch('/api/stream-keys/refresh', {
    method: 'POST',
    headers: await authJsonHeaders(),
    body: JSON.stringify({ id }),
  });
  const payload = await response.json().catch(() => ({}));
  handleSubscriptionRequired(response, payload);
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to refresh stream key');
  }
  return payload.stream_key;
}

export async function deleteStreamKey(id) {
  const response = await fetch(`/api/stream-keys?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authJsonHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to delete stream key');
  }
}

export async function updateStreamKeyStatus(id, status) {
  const { data, error } = await supabase
    .from('stream_keys')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
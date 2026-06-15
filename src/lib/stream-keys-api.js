import { supabase } from '@/lib/supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be logged in');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function createStreamKey(streamName) {
  const response = await fetch('/api/stream-keys', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ stream_name: streamName }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to create stream key');
  }
  return payload.stream_key;
}

export async function refreshStreamKey(id) {
  const response = await fetch('/api/stream-keys/refresh', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ id }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to refresh stream key');
  }
  return payload.stream_key;
}

export async function deleteStreamKey(id) {
  const response = await fetch(`/api/stream-keys?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
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
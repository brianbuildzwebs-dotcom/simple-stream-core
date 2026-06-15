export function supabaseHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function requireSupabaseUrl(env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!url) {
    throw new Error('SUPABASE_URL is not configured on the Worker');
  }
  return url;
}

export async function supabaseSelect(env, table, query) {
  const response = await fetch(`${requireSupabaseUrl(env)}/rest/v1/${table}?${query}`, {
    headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function supabaseInsert(env, table, row) {
  const response = await fetch(`${requireSupabaseUrl(env)}/rest/v1/${table}`, {
    method: 'POST',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY, {
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Insert failed: ${table}`);
  }
  const rows = await response.json();
  return rows?.[0] ?? null;
}

export async function supabaseUpdate(env, table, query, patch) {
  const response = await fetch(`${requireSupabaseUrl(env)}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY, {
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] ?? null;
}

export async function supabaseDelete(env, table, query) {
  const response = await fetch(`${requireSupabaseUrl(env)}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  return response.ok;
}

export async function getUserStreamKeyLimit(env, userId) {
  const subs = await supabaseSelect(
    env,
    'user_subscriptions',
    `user_id=eq.${userId}&select=subscription_tier_id,is_paid,payment_status,trial_active`
  );
  const sub = subs?.[0];
  if (!sub?.subscription_tier_id) return 1;

  const tiers = await supabaseSelect(
    env,
    'subscription_tiers',
    `id=eq.${sub.subscription_tier_id}&select=max_stream_keys`
  );
  return tiers?.[0]?.max_stream_keys ?? 1;
}

export async function countUserStreamKeys(env, userId) {
  const rows = await supabaseSelect(
    env,
    'stream_keys',
    `user_id=eq.${userId}&status=neq.revoked&select=id`
  );
  return rows?.length ?? 0;
}
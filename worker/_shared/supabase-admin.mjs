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
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Update failed: ${table}`);
  }
  const rows = await response.json();
  return rows?.[0] ?? null;
}

const OPTIONAL_USER_SUBSCRIPTION_COLUMNS = [
  'stripe_subscription_id',
  'enterprise_offer_tier_id',
  'enterprise_offer_note',
  'enterprise_offer_at',
  'billing_managed_by',
  'enterprise_requested_at',
  'enterprise_request_note',
  'subscription_cancel_at',
];

function isMissingColumnError(error) {
  const message = String(error?.message || error || '');
  return message.includes('schema cache') || message.includes('PGRST204');
}

function stripOptionalSubscriptionColumns(patch) {
  const next = { ...patch };
  for (const column of OPTIONAL_USER_SUBSCRIPTION_COLUMNS) {
    delete next[column];
  }
  return next;
}

async function writeUserSubscription(env, userId, patch) {
  const rows = await supabaseSelect(
    env,
    'user_subscriptions',
    `user_id=eq.${userId}&select=id`
  );

  if (rows?.[0]) {
    const updated = await supabaseUpdate(env, 'user_subscriptions', `user_id=eq.${userId}`, patch);
    if (!updated) {
      throw new Error('Failed to update user subscription');
    }
    return updated;
  }

  const inserted = await supabaseInsert(env, 'user_subscriptions', {
    user_id: userId,
    trial_active: false,
    payment_method: 'none',
    payment_status: 'trial',
    is_paid: false,
    ...patch,
  });
  if (!inserted) {
    throw new Error('Failed to create user subscription');
  }
  return inserted;
}

export async function upsertUserSubscription(env, userId, patch) {
  try {
    return await writeUserSubscription(env, userId, patch);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    const fallbackPatch = stripOptionalSubscriptionColumns(patch);
    if (JSON.stringify(fallbackPatch) === JSON.stringify(patch)) {
      throw error;
    }
    return writeUserSubscription(env, userId, fallbackPatch);
  }
}

export async function supabaseDelete(env, table, query) {
  const response = await fetch(`${requireSupabaseUrl(env)}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  return response.ok;
}

async function isUserAdminProfile(env, userId) {
  const rows = await supabaseSelect(env, 'profiles', `id=eq.${userId}&select=role`);
  return rows?.[0]?.role === 'admin';
}

async function resolveTierMaxStreamKeys(env, { tierId, tierName, monthlyPrice }) {
  if (tierId) {
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `id=eq.${tierId}&select=max_stream_keys`
    );
    if (tiers?.[0]?.max_stream_keys != null) {
      return tiers[0].max_stream_keys;
    }
  }

  if (tierName) {
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `name=eq.${encodeURIComponent(tierName)}&select=max_stream_keys`
    );
    if (tiers?.[0]?.max_stream_keys != null) {
      return tiers[0].max_stream_keys;
    }
  }

  if (monthlyPrice != null) {
    const tiers = await supabaseSelect(
      env,
      'subscription_tiers',
      `monthly_price=eq.${monthlyPrice}&select=max_stream_keys&order=sort_order.asc&limit=1`
    );
    if (tiers?.[0]?.max_stream_keys != null) {
      return tiers[0].max_stream_keys;
    }
  }

  return null;
}

function resolveActiveTierReference(subscription) {
  if (!subscription) return { tierId: null, tierName: null };

  let tierId = subscription.subscription_tier_id || null;
  let tierName = subscription.tier_name || null;

  if (!subscription.enterprise_offer_tier_id) {
    return { tierId, tierName };
  }

  const offerTierId = subscription.enterprise_offer_tier_id;
  const alreadyOnEnterprise =
    tierName === 'Enterprise' &&
    (subscription.billing_managed_by === 'manual' ||
      subscription.payment_method === 'manual_admin') &&
    tierId &&
    tierId !== offerTierId;

  if (alreadyOnEnterprise) {
    return { tierId, tierName };
  }

  if (tierId && tierId === offerTierId) {
    tierId = null;
  }
  if (tierName === 'Enterprise') {
    tierName = null;
  }

  return { tierId, tierName };
}

export async function getUserStreamKeyLimit(env, userId) {
  const [subs, isAdmin] = await Promise.all([
    supabaseSelect(
      env,
      'user_subscriptions',
      `user_id=eq.${userId}&select=subscription_tier_id,tier_name,is_paid,payment_status,trial_active,last_payment_amount,enterprise_offer_tier_id,billing_managed_by,payment_method`
    ),
    isUserAdminProfile(env, userId),
  ]);
  const sub = subs?.[0];
  const { tierId, tierName } = resolveActiveTierReference(sub);

  const tierLimit = await resolveTierMaxStreamKeys(env, {
    tierId,
    tierName,
    monthlyPrice: sub?.last_payment_amount,
  });

  if (isAdmin || sub?.payment_status === 'free_admin') {
    if (tierLimit != null && (sub?.is_paid || sub?.payment_status === 'subscribed')) {
      return tierLimit;
    }
    return 10;
  }
  if (tierLimit != null) {
    return tierLimit;
  }

  if (sub?.is_paid || sub?.payment_status === 'subscribed') {
    return 1;
  }

  return 1;
}

export async function getUserStreamKeyUsage(env, userId) {
  const [limit, count] = await Promise.all([
    getUserStreamKeyLimit(env, userId),
    countUserStreamKeys(env, userId),
  ]);
  return { limit, count, remaining: Math.max(0, limit - count) };
}

export async function countUserStreamKeys(env, userId) {
  const rows = await supabaseSelect(
    env,
    'stream_keys',
    `user_id=eq.${userId}&status=neq.revoked&select=id`
  );
  return rows?.length ?? 0;
}
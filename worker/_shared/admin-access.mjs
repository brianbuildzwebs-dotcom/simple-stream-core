import { verifyCloudflareAccessRequest, isCloudflareAccessConfigured } from './cloudflare-access.mjs';
import { hashEmailForAudit } from './legal-acceptance.mjs';
import { supabaseSelect } from './supabase-admin.mjs';

function readJwtAal(token) {
  if (!token) return null;
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));
    return payload.aal || 'aal1';
  } catch {
    return null;
  }
}

export async function isUserAdmin(env, userId) {
  const rows = await supabaseSelect(env, 'profiles', `id=eq.${userId}&select=role`);
  return rows?.[0]?.role === 'admin';
}

export async function verifyAdminUser(request, env, verifySupabaseUser) {
  const { user, reason, token } = await verifySupabaseUser(request, env);
  if (!user) {
    return { user: null, reason };
  }

  const isAdmin = await isUserAdmin(env, user.id);
  if (!isAdmin) {
    return { user: null, reason: 'forbidden' };
  }

  const mfaSatisfied = readJwtAal(token) === 'aal2';

  if (isCloudflareAccessConfigured(env)) {
    const access = await verifyCloudflareAccessRequest(request, env);
    if (access.ok || mfaSatisfied) {
      return { user, reason: null };
    }
    return { user: null, reason: 'access_required' };
  }

  if (!mfaSatisfied) {
    return { user: null, reason: 'mfa_required' };
  }

  return { user, reason: null };
}

async function fetchAuthUserById(env, userId) {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function listAuthUsers(env) {
  const url = `${env.SUPABASE_URL?.trim().replace(/\/$/, '')}/auth/v1/admin/users?per_page=200`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load auth users');
  }

  const payload = await response.json();
  return payload.users ?? [];
}

export async function getAdminPlatformStats(env) {
  const [subs, abuse, keys, embeds, legalEvents] = await Promise.all([
    supabaseSelect(env, 'user_subscriptions', 'select=payment_status,is_paid'),
    supabaseSelect(env, 'trial_abuse', 'is_resolved=eq.false&select=registration_count'),
    supabaseSelect(env, 'stream_keys', 'status=neq.revoked&select=id'),
    supabaseSelect(env, 'embed_instances', 'select=id'),
    supabaseSelect(env, 'legal_acceptance_events', 'select=id,account_deleted_at,user_id'),
  ]);

  const subscriptions = subs ?? [];
  const legal = legalEvents ?? [];
  return {
    total: subscriptions.length,
    trial: subscriptions.filter((s) => s.payment_status === 'trial').length,
    paid: subscriptions.filter((s) => s.is_paid).length,
    expired: subscriptions.filter((s) => s.payment_status === 'unpaid_trial_expired').length,
    free_admin: subscriptions.filter((s) => s.payment_status === 'free_admin').length,
    flagged: (abuse ?? []).filter((a) => a.registration_count > 1).length,
    streams: keys?.length ?? 0,
    embeds: embeds?.length ?? 0,
    legal_acceptance_total: legal.length,
    legal_acceptance_active: legal.filter((event) => !event.account_deleted_at && event.user_id).length,
    legal_acceptance_anonymized: legal.filter((event) => event.account_deleted_at).length,
  };
}

function previewHash(value) {
  if (!value) return null;
  return `${String(value).slice(0, 12)}...`;
}

async function enrichLegalAcceptanceEvents(env, events) {
  const userIds = [...new Set((events ?? []).filter((event) => event.user_id).map((event) => event.user_id))];
  const authUsers = await Promise.all(userIds.map((userId) => fetchAuthUserById(env, userId)));
  const authMap = Object.fromEntries(
    userIds.map((userId, index) => [userId, authUsers[index]])
  );

  return (events ?? []).map((event) => {
    const authUser = event.user_id ? authMap[event.user_id] : null;
    const status = event.account_deleted_at
      ? 'anonymized'
      : event.user_id
        ? 'active'
        : 'orphaned';

    return {
      id: event.id,
      user_id: event.user_id,
      email_hash: event.email_hash,
      email_hash_preview: previewHash(event.email_hash),
      terms_version: event.terms_version,
      privacy_version: event.privacy_version,
      accepted_at: event.accepted_at,
      acceptance_method: event.acceptance_method,
      ip_address_hash_preview: previewHash(event.ip_address_hash),
      user_agent: event.user_agent,
      account_deleted_at: event.account_deleted_at,
      created_at: event.created_at,
      status,
      user: event.user_id
        ? {
            id: event.user_id,
            email: authUser?.email ?? null,
            full_name: authUser?.user_metadata?.full_name ?? null,
          }
        : null,
    };
  });
}

export async function getAdminLegalAcceptanceEvents(env, { status = 'all', email, userId, limit = 100 } = {}) {
  let query =
    'select=id,user_id,email_hash,terms_version,privacy_version,accepted_at,acceptance_method,ip_address_hash,user_agent,account_deleted_at,created_at&order=accepted_at.desc';

  const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  query += `&limit=${cappedLimit}`;

  if (status === 'active') {
    query += '&account_deleted_at=is.null&user_id=not.is.null';
  } else if (status === 'deleted') {
    query += '&account_deleted_at=not.is.null';
  }

  if (userId) {
    query += `&user_id=eq.${encodeURIComponent(userId)}`;
  }

  if (email) {
    const emailHash = await hashEmailForAudit(email, env);
    query += `&email_hash=eq.${encodeURIComponent(emailHash)}`;
  }

  const events = (await supabaseSelect(env, 'legal_acceptance_events', query)) ?? [];
  const enriched = await enrichLegalAcceptanceEvents(env, events);

  return {
    events: enriched,
    summary: {
      returned: enriched.length,
      active: enriched.filter((event) => event.status === 'active').length,
      anonymized: enriched.filter((event) => event.status === 'anonymized').length,
    },
  };
}

export async function getAdminUsers(env) {
  const [subs, profiles, authUsers, abuse] = await Promise.all([
    supabaseSelect(env, 'user_subscriptions', 'select=*&order=created_at.desc'),
    supabaseSelect(env, 'profiles', 'select=id,role,full_name'),
    listAuthUsers(env),
    supabaseSelect(env, 'trial_abuse', 'select=email_list,registration_count,is_resolved'),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const authMap = Object.fromEntries((authUsers ?? []).map((u) => [u.id, u]));

  const users = (subs ?? []).map((sub) => {
    const profile = profileMap[sub.user_id] ?? {};
    const authUser = authMap[sub.user_id] ?? {};
    return {
      subscription: sub,
      profile: {
        id: sub.user_id,
        role: profile.role ?? 'viewer',
        full_name: profile.full_name ?? authUser.user_metadata?.full_name ?? null,
        email: authUser.email ?? null,
      },
    };
  });

  return { users, abuse: abuse ?? [] };
}
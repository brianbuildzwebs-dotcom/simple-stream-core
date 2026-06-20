import { supabaseInsert, supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

const IP_SALT = 'ssz_ip_hash_salt_v1';
const EMAIL_SALT = 'ssz_legal_audit_salt_v1';
const VALID_METHODS = new Set(['email', 'google', 'oauth', 'reaccept']);

async function hashValue(value, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(value).trim().toLowerCase() + salt);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function auditSalt(env) {
  return env?.LEGAL_AUDIT_SALT?.trim() || '';
}

export async function hashEmailForAudit(email, env) {
  return hashValue(email, EMAIL_SALT + auditSalt(env));
}

export async function hashIpForAudit(ip, env) {
  return hashValue(ip, IP_SALT + auditSalt(env));
}

export function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP')?.trim() ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    request.headers.get('X-Real-IP')?.trim() ||
    'unknown'
  );
}

function truncateUserAgent(userAgent) {
  if (!userAgent) return null;
  return String(userAgent).slice(0, 512);
}

export async function recordLegalAcceptanceEvent(env, { user, request, termsVersion, privacyVersion, acceptanceMethod }) {
  if (!user?.id || !user?.email) {
    throw new Error('User identity required');
  }

  const terms = String(termsVersion || '').trim();
  const privacy = String(privacyVersion || '').trim();
  if (!terms || !privacy) {
    throw new Error('termsVersion and privacyVersion are required');
  }

  const method = VALID_METHODS.has(acceptanceMethod) ? acceptanceMethod : 'email';

  const existing = await supabaseSelect(
    env,
    'legal_acceptance_events',
    `user_id=eq.${user.id}&terms_version=eq.${encodeURIComponent(terms)}&privacy_version=eq.${encodeURIComponent(privacy)}&account_deleted_at=is.null&select=id&limit=1`
  );
  if (existing?.length > 0) {
    return { recorded: false, duplicate: true, id: existing[0].id };
  }

  const ip = getClientIp(request);
  const row = await supabaseInsert(env, 'legal_acceptance_events', {
    user_id: user.id,
    email_hash: await hashEmailForAudit(user.email, env),
    terms_version: terms,
    privacy_version: privacy,
    accepted_at: new Date().toISOString(),
    acceptance_method: method,
    ip_address_hash: ip !== 'unknown' ? await hashIpForAudit(ip, env) : null,
    user_agent: truncateUserAgent(request.headers.get('User-Agent')),
  });

  return { recorded: true, id: row?.id };
}

export async function anonymizeLegalAcceptanceOnAccountDeletion(env, userId) {
  if (!userId) return { updated: 0 };

  const rows = await supabaseSelect(
    env,
    'legal_acceptance_events',
    `user_id=eq.${userId}&account_deleted_at=is.null&select=id`
  );
  if (!rows?.length) {
    return { updated: 0 };
  }

  const deletedAt = new Date().toISOString();
  for (const row of rows) {
    await supabaseUpdate(env, 'legal_acceptance_events', `id=eq.${row.id}`, {
      user_id: null,
      account_deleted_at: deletedAt,
    });
  }

  return { updated: rows.length };
}
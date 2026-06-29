import { getClientIp, hashIpForAudit } from './legal-acceptance.mjs';
import { supabaseInsert, supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

export function getTrialIpLimit(env) {
  const raw = Number(env.TRIAL_MAX_REGISTRATIONS_PER_IP);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 2;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function assessTrialRegistration(env, { user, request }) {
  const ip = getClientIp(request);
  if (ip === 'unknown' || !user?.email) {
    return { allowed: true, tracked: false, reason: null };
  }

  const ipHash = await hashIpForAudit(ip, env);
  const email = normalizeEmail(user.email);
  const limit = getTrialIpLimit(env);

  await supabaseUpdate(env, 'profiles', `id=eq.${user.id}`, { ip_hash: ipHash });

  const rows =
    (await supabaseSelect(
      env,
      'trial_abuse',
      `ip_address_hash=eq.${encodeURIComponent(ipHash)}&select=*&limit=1`
    )) ?? [];
  const existing = rows[0];

  if (!existing) {
    await supabaseInsert(env, 'trial_abuse', {
      ip_address_hash: ipHash,
      email_list: [email],
      registration_count: 1,
      admin_action: 'pending_review',
      is_resolved: false,
    });
    return { allowed: true, tracked: true, reason: null, registrationCount: 1, limit };
  }

  if (existing.is_resolved) {
    return {
      allowed: true,
      tracked: false,
      reason: null,
      registrationCount: existing.registration_count,
      limit,
      resolved: true,
    };
  }

  const emails = Array.isArray(existing.email_list) ? existing.email_list : [];
  const alreadyListed = emails.some((entry) => normalizeEmail(entry) === email);

  if (alreadyListed) {
    return {
      allowed: true,
      tracked: false,
      reason: null,
      registrationCount: existing.registration_count,
      limit,
      duplicateEmail: true,
    };
  }

  const nextCount = (existing.registration_count || 0) + 1;
  const blocked = nextCount > limit;

  await supabaseUpdate(env, 'trial_abuse', `id=eq.${existing.id}`, {
    email_list: [...emails, email],
    registration_count: nextCount,
    flagged_date: blocked ? new Date().toISOString() : existing.flagged_date,
    admin_action: blocked ? 'auto_blocked' : existing.admin_action,
  });

  if (blocked) {
    return {
      allowed: false,
      tracked: true,
      reason: 'trial_ip_limit',
      registrationCount: nextCount,
      limit,
    };
  }

  return {
    allowed: true,
    tracked: true,
    reason: null,
    registrationCount: nextCount,
    limit,
  };
}
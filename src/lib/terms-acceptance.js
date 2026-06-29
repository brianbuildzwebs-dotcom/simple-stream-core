import { authJsonHeaders } from '@/lib/api-auth';
import { supabase } from '@/lib/supabase';
import { LEGAL_VERSION } from '@/lib/legal';

export const PENDING_TERMS_STORAGE_KEY = 'ssz_pending_terms';

export function buildTermsAcceptanceMetadata() {
  const acceptedAt = new Date().toISOString();
  return {
    terms_accepted_at: acceptedAt,
    terms_version: LEGAL_VERSION,
    privacy_accepted_at: acceptedAt,
    privacy_version: LEGAL_VERSION,
  };
}

export function stageTermsAcceptanceForOAuth() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_TERMS_STORAGE_KEY, LEGAL_VERSION);
}

export function userHasAcceptedTermsInMetadata(user) {
  const meta = user?.user_metadata ?? {};
  return Boolean(meta.terms_accepted_at && meta.terms_version);
}

function resolveTermsMetadata(user) {
  const meta = user?.user_metadata ?? {};
  if (meta.terms_accepted_at && meta.terms_version) {
    return {
      terms_accepted_at: meta.terms_accepted_at,
      terms_version: meta.terms_version,
      privacy_accepted_at: meta.privacy_accepted_at || meta.terms_accepted_at,
      privacy_version: meta.privacy_version || meta.terms_version,
    };
  }
  return buildTermsAcceptanceMetadata();
}

function inferAcceptanceMethod(user, { acceptanceMethod, pendingOAuth } = {}) {
  if (acceptanceMethod) return acceptanceMethod;
  if (pendingOAuth) return 'google';
  const provider = user?.app_metadata?.provider;
  if (provider === 'google') return 'google';
  return 'email';
}

async function recordLegalAcceptanceAudit({
  acceptanceMethod = 'email',
  termsVersion = LEGAL_VERSION,
  privacyVersion = LEGAL_VERSION,
} = {}) {
  try {
    const response = await fetch('/api/legal/accept', {
      method: 'POST',
      headers: await authJsonHeaders(),
      body: JSON.stringify({
        termsVersion,
        privacyVersion,
        acceptanceMethod,
      }),
      keepalive: true,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.warn('Legal acceptance audit failed:', payload.error || response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Legal acceptance audit failed:', error.message);
    return false;
  }
}

export async function recordTermsAcceptance(userId, { acceptanceMethod = 'email', user } = {}) {
  if (!userId) return;
  const metadata = resolveTermsMetadata(user);

  await supabase.auth.updateUser({ data: metadata });

  const { error } = await supabase
    .from('profiles')
    .update({
      terms_accepted_at: metadata.terms_accepted_at,
      terms_version: metadata.terms_version,
      privacy_accepted_at: metadata.privacy_accepted_at,
      privacy_version: metadata.privacy_version,
    })
    .eq('id', userId);

  if (error) {
    console.warn('Could not persist terms acceptance on profile:', error.message);
  }

  await recordLegalAcceptanceAudit({
    acceptanceMethod,
    termsVersion: metadata.terms_version,
    privacyVersion: metadata.privacy_version,
  });
}

function legalAuditSyncedKey(userId) {
  return `ssz_legal_audit_synced_${userId}`;
}

export async function ensureLegalAcceptanceRecorded(user, { acceptanceMethod } = {}) {
  if (typeof window === 'undefined' || !user?.id) return;

  const pending = window.sessionStorage.getItem(PENDING_TERMS_STORAGE_KEY);
  const hasMetadata = userHasAcceptedTermsInMetadata(user);
  if (!pending && !hasMetadata) return;

  if (!pending && hasMetadata && window.sessionStorage.getItem(legalAuditSyncedKey(user.id))) {
    return;
  }

  const method = inferAcceptanceMethod(user, { acceptanceMethod, pendingOAuth: Boolean(pending) });
  await recordTermsAcceptance(user.id, { acceptanceMethod: method, user });

  if (pending) {
    window.sessionStorage.removeItem(PENDING_TERMS_STORAGE_KEY);
  } else if (hasMetadata) {
    window.sessionStorage.setItem(legalAuditSyncedKey(user.id), '1');
  }
}

export async function finalizePendingTermsAcceptance(user, options = {}) {
  return ensureLegalAcceptanceRecorded(user, options);
}
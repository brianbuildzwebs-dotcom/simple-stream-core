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

async function recordLegalAcceptanceAudit({ acceptanceMethod = 'email' } = {}) {
  try {
    const response = await fetch('/api/legal/accept', {
      method: 'POST',
      headers: await authJsonHeaders(),
      body: JSON.stringify({
        termsVersion: LEGAL_VERSION,
        privacyVersion: LEGAL_VERSION,
        acceptanceMethod,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.warn('Legal acceptance audit failed:', payload.error || response.status);
    }
  } catch (error) {
    console.warn('Legal acceptance audit failed:', error.message);
  }
}

export async function recordTermsAcceptance(userId, { acceptanceMethod = 'email' } = {}) {
  if (!userId) return;
  const metadata = buildTermsAcceptanceMetadata();

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

  await recordLegalAcceptanceAudit({ acceptanceMethod });
}

export async function finalizePendingTermsAcceptance(user, { acceptanceMethod = 'google' } = {}) {
  if (typeof window === 'undefined' || !user?.id) return;
  const pending = window.sessionStorage.getItem(PENDING_TERMS_STORAGE_KEY);
  if (!pending) return;
  await recordTermsAcceptance(user.id, { acceptanceMethod });
  window.sessionStorage.removeItem(PENDING_TERMS_STORAGE_KEY);
}
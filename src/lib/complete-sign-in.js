import { supabase } from '@/lib/supabase';
import { recordTermsAcceptance } from '@/lib/terms-acceptance';

export async function waitForAuthSession({ attempts = 20, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (session?.user) return session;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function completeSignIn({
  userId,
  acceptanceMethod = 'email',
  recordTerms = false,
} = {}) {
  const session = await waitForAuthSession();
  if (!session?.user) {
    throw new Error('Sign-in did not complete. Please try again.');
  }

  const resolvedUserId = userId || session.user.id;

  if (recordTerms && resolvedUserId) {
    void recordTermsAcceptance(resolvedUserId, { acceptanceMethod }).catch(() => {});
  }

  window.location.replace('/dashboard');
}
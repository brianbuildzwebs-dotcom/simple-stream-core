/**
 * Cloudflare Turnstile server-side verification.
 * Fails open when TURNSTILE_SECRET_KEY is unset (local dev).
 */

export function turnstileConfigured(env) {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyTurnstileToken(env, token, remoteip) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { success: true, skipped: true };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'missing_token' };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteip && remoteip !== 'unknown') {
    body.set('remoteip', remoteip);
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const result = await response.json().catch(() => ({}));
    return {
      success: Boolean(result.success),
      error: result['error-codes']?.[0] ?? null,
      hostname: result.hostname ?? null,
    };
  } catch (error) {
    return { success: false, error: error.message || 'siteverify_failed' };
  }
}
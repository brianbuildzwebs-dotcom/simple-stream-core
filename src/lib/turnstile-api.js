export async function verifyTurnstileToken(token) {
  const response = await fetch('/api/turnstile/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Bot verification failed. Please try again.');
  }

  return payload;
}
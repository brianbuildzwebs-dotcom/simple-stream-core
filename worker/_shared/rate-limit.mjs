/**
 * Lightweight per-IP rate limits using PLATFORM_SETTINGS KV.
 * Fails open if KV is unavailable so legitimate traffic is not blocked.
 */

function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function checkRateLimit(
  env,
  request,
  bucket,
  { limit = 60, windowSec = 60 } = {}
) {
  const kv = env.PLATFORM_SETTINGS;
  if (!kv) return { ok: true, remaining: limit };

  const ip = clientIp(request);
  const window = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${bucket}:${ip}:${window}`;

  try {
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (!Number.isFinite(count) || count >= limit) {
      return { ok: false, remaining: 0 };
    }
    await kv.put(key, String(count + 1), { expirationTtl: windowSec * 2 });
    return { ok: true, remaining: Math.max(0, limit - count - 1) };
  } catch {
    return { ok: true, remaining: limit };
  }
}

export function rateLimitedResponse(corsHeaders) {
  return Response.json(
    { error: 'Too many requests. Please wait a moment and try again.' },
    { status: 429, headers: corsHeaders }
  );
}
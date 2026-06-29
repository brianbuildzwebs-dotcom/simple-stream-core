import * as Sentry from '@sentry/cloudflare';
import {
  resolvePlaylistBroadcasts,
  resolveVideoBroadcast,
} from '../functions/_shared/youtube-innertube.mjs';
import {
  buildHlsPlaybackUrl,
  createCloudflareLiveInput,
  deleteCloudflareLiveInput,
  enableCloudflareLiveInputPlayback,
  normalizeCloudflareRtmpsIngestUrl,
} from './_shared/cloudflare-stream.mjs';
import { initUserSubscriptionForUser } from './_shared/subscription-init.mjs';
import {
  listUserStreamAlerts,
  markStreamAlertsRead,
  runStreamMonitorCron,
  syncStreamKeyConnectivity,
} from './_shared/stream-monitor.mjs';
import {
  deleteSermonRecording,
  getSermonRetentionUsage,
  listUserSermonRecordings,
  prepareSermonDownload,
  runSermonLibraryCron,
} from './_shared/sermon-library.mjs';
import {
  getUserServiceSchedule,
  saveUserServiceSchedule,
} from './_shared/service-schedule.mjs';
import {
  getAdminPlatformSettings,
  getPublicLaunchConfig,
  patchAdminPlatformSettings,
} from './_shared/platform-settings.mjs';
import { deleteCloudflareVideo } from './_shared/cloudflare-stream.mjs';
import { resolveEmbedConfig, recordEmbedView } from './_shared/embed-config.mjs';
import {
  assertPlatformAccess,
  resolveOwnerWatermarkPolicy,
  SubscriptionAccessError,
} from './_shared/subscription-access.mjs';
import {
  getAdminLegalAcceptanceEvents,
  getAdminPlatformStats,
  getAdminUsers,
  verifyAdminUser,
} from './_shared/admin-access.mjs';
import {
  acceptEnterpriseOffer,
  declineEnterpriseOffer,
  getEnterpriseOfferForUser,
  clearEnterpriseOffer,
  offerEnterpriseUpgrade,
  submitEnterpriseRequest,
} from './_shared/enterprise-offers.mjs';
import {
  isValidStripeSecretKey,
  normalizeStripeSecretKey,
} from './_shared/stripe-secrets.mjs';
import { deleteUserAccount } from './_shared/account-deletion.mjs';
import { recordLegalAcceptanceEvent } from './_shared/legal-acceptance.mjs';
import {
  cancelUserSubscription,
  createBillingPortalSession,
} from './_shared/subscription-billing.mjs';
import { resolveBillingReturnUrl } from './_shared/stripe-customer.mjs';
import {
  activateFromCheckoutSession,
  handleStripeWebhookEvent,
  syncUserSubscriptionFromStripe,
  tryUpgradeStripeSubscription,
  verifyStripeWebhookSignature,
} from './_shared/stripe-webhook.mjs';
import {
  countUserStreamKeys,
  getUserStreamKeyLimit,
  getUserStreamKeyUsage,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from './_shared/supabase-admin.mjs';
import { checkRateLimit, rateLimitedResponse } from './_shared/rate-limit.mjs';
import { normalizeGiveUrl } from './_shared/give-link.mjs';
import { turnstileConfigured, verifyTurnstileToken } from './_shared/turnstile.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const EMBED_PATCH_FIELDS = new Set([
  'name',
  'allowed_domains',
  'video_source_type',
  'video_source_url',
  'stream_key_id',
  'is_watermark_enabled',
  'watermark_text',
  'watermark_position',
  'watermark_size',
  'watermark_opacity',
  'is_active',
  'chat_enabled',
  'holding_title',
  'holding_message',
  'replay_when_offline',
  'give_enabled',
  'give_url',
  'give_label',
]);

async function assertUserStreamKey(env, userId, streamKeyId) {
  if (!streamKeyId) return;
  const rows = await supabaseSelect(
    env,
    'stream_keys',
    `id=eq.${streamKeyId}&user_id=eq.${userId}&select=id`
  );
  if (!rows?.[0]) {
    throw new Error('Stream key not found');
  }
}

function publicAuthHealth(env) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  return {
    ok: Boolean(
      env.SUPABASE_URL?.trim() &&
        (env.SUPABASE_ANON_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim()) &&
        stripeKey &&
        env.STRIPE_WEBHOOK_SECRET?.trim()
    ),
    auth: Boolean(env.SUPABASE_URL?.trim()),
    billing: Boolean(stripeKey && env.STRIPE_WEBHOOK_SECRET?.trim()),
    streaming: Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim()),
    email: Boolean(env.EMAIL?.send),
    turnstile: turnstileConfigured(env),
  };
}

function adminAuthConfigStatus(env) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  return {
    ...publicAuthHealth(env),
    supabase_service_role_key: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    stripe_key_format_valid: isValidStripeSecretKey(stripeKey),
    stripe_webhook: Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()),
  };
}

function subscriptionRequiredResponse() {
  return Response.json(
    {
      error: 'Active subscription required. Upgrade to continue.',
      code: 'subscription_required',
    },
    { status: 402, headers: CORS }
  );
}

function adminDeniedResponse(reason) {
  if (reason === 'mfa_required') {
    return Response.json(
      { error: 'Admin MFA is required for this action.', code: 'mfa_required' },
      { status: 403, headers: CORS }
    );
  }
  if (reason === 'access_required' || reason === 'missing_access_jwt' || reason === 'invalid_access_jwt') {
    return Response.json(
      { error: 'Cloudflare Access is required for admin API calls.', code: 'access_required' },
      { status: 403, headers: CORS }
    );
  }
  return Response.json({ error: 'Forbidden' }, { status: 403, headers: CORS });
}

async function verifySupabaseUser(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const apiKey = env.SUPABASE_ANON_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!token) {
    return { user: null, token: null, reason: 'no_token' };
  }
  if (!supabaseUrl) {
    return { user: null, token: null, reason: 'missing_supabase_url' };
  }
  if (!apiKey) {
    return { user: null, token: null, reason: 'missing_supabase_key' };
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: apiKey,
    },
  });

  if (!response.ok) {
    return { user: null, token: null, reason: 'invalid_token' };
  }

  const user = await response.json();
  if (!user?.id) {
    return { user: null, token: null, reason: 'invalid_token' };
  }

  return { user, token, reason: null };
}

function unauthorizedResponse(reason) {
  if (reason === 'missing_supabase_url' || reason === 'missing_supabase_key') {
    return Response.json(
      {
        error: 'Server auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the Worker.',
        code: 'auth_not_configured',
      },
      { status: 503, headers: CORS }
    );
  }

  if (reason === 'missing_access_jwt' || reason === 'invalid_access_jwt') {
    return Response.json(
      { error: 'Cloudflare Access required', code: reason },
      { status: 403, headers: CORS }
    );
  }

  return Response.json({ error: 'Unauthorized', code: reason || 'unauthorized' }, { status: 401, headers: CORS });
}

async function fetchSubscriptionTier(tierId, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/subscription_tiers?id=eq.${tierId}&is_active=eq.true&select=*`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!response.ok) return null;
  const tiers = await response.json();
  return tiers?.[0] ?? null;
}

async function createStripeCheckoutSession({ tier, user, successUrl, cancelUrl, customerId }, env) {
  const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
  if (!stripeKey) {
    throw new Error('Stripe is not configured');
  }
  if (!isValidStripeSecretKey(stripeKey)) {
    const prefix = stripeKey.slice(0, 16);
    throw new Error(
      `STRIPE_SECRET_KEY is misconfigured (stored value starts with "${prefix}..."). Run: powershell -File scripts/fix-stripe-secret-key.ps1 — paste only your sk_test_... Secret key from Stripe Developers → API keys.`
    );
  }

  const params = new URLSearchParams({
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    'metadata[user_id]': user.id,
    'metadata[tier_id]': tier.id,
    'metadata[tier_name]': tier.name,
    'subscription_data[metadata][user_id]': user.id,
    'subscription_data[metadata][tier_id]': tier.id,
    'subscription_data[metadata][tier_name]': tier.name,
  });

  if (customerId) {
    params.set('customer', customerId);
  } else if (user.email) {
    params.set('customer_email', user.email);
  }

  if (tier.stripe_price_id) {
    params.set('line_items[0][price]', tier.stripe_price_id);
    params.set('line_items[0][quantity]', '1');
  } else {
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set(
      'line_items[0][price_data][unit_amount]',
      String(Math.round(Number(tier.monthly_price) * 100))
    );
    params.set('line_items[0][price_data][recurring][interval]', 'month');
    params.set('line_items[0][price_data][product_data][name]', `${tier.name} — Simple Streamz`);
    params.set('line_items[0][quantity]', '1');
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Stripe checkout failed');
  }

  return payload;
}

function isLegacyWorkersDevHost(hostname) {
  return String(hostname || '').toLowerCase().endsWith('.workers.dev');
}

/** Send browsers from *.workers.dev to PUBLIC_APP_URL; keep API POSTs for legacy webhooks. */
function maybeRedirectLegacyWorkersDevHost(request, url, env) {
  if (!isLegacyWorkersDevHost(url.hostname)) {
    return null;
  }

  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return null;
  }

  const canonicalBase =
    env.PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://simplestreamz.io';
  const target = new URL(`${url.pathname}${url.search}`, canonicalBase);
  if (target.hostname.toLowerCase() === url.hostname.toLowerCase()) {
    return null;
  }

  return Response.redirect(target.toString(), 301);
}

const handler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const legacyRedirect = maybeRedirectLegacyWorkersDevHost(request, url, env);
    if (legacyRedirect) {
      return legacyRedirect;
    }

    if (
      url.pathname === '/api/admin/stats' ||
      url.pathname === '/api/admin/users' ||
      url.pathname === '/api/admin/legal-acceptance'
    ) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifyAdminUser(request, env, verifySupabaseUser);
        if (!user) {
          if (reason === 'forbidden' || reason === 'mfa_required' || reason === 'access_required' || reason === 'missing_access_jwt' || reason === 'invalid_access_jwt') {
            return adminDeniedResponse(reason);
          }
          return unauthorizedResponse(reason);
        }

        if (url.pathname === '/api/admin/stats') {
          const stats = await getAdminPlatformStats(env);
          return Response.json(stats, { headers: CORS });
        }

        if (url.pathname === '/api/admin/legal-acceptance') {
          const payload = await getAdminLegalAcceptanceEvents(env, {
            status: url.searchParams.get('status') || 'all',
            email: url.searchParams.get('email') || '',
            userId: url.searchParams.get('userId') || '',
            limit: url.searchParams.get('limit') || 100,
          });
          return Response.json(payload, { headers: CORS });
        }

        const payload = await getAdminUsers(env);
        return Response.json(payload, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'admin_request_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/admin/enterprise-offer') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifyAdminUser(request, env, verifySupabaseUser);
        if (!user) {
          if (reason === 'forbidden' || reason === 'mfa_required' || reason === 'access_required' || reason === 'missing_access_jwt' || reason === 'invalid_access_jwt') {
            return adminDeniedResponse(reason);
          }
          return unauthorizedResponse(reason);
        }

        const body = await request.json().catch(() => ({}));
        const targetUserId = (body.user_id || '').trim();
        const action = (body.action || 'offer').trim();

        if (!targetUserId) {
          return Response.json({ error: 'user_id is required' }, { status: 400, headers: CORS });
        }

        if (action === 'cancel') {
          const subscription = await clearEnterpriseOffer(env, targetUserId);
          return Response.json({ subscription }, { headers: CORS });
        }

        const tierId = (body.tier_id || '').trim();
        const note = (body.note || '').trim();

        if (!tierId) {
          return Response.json({ error: 'tier_id is required' }, { status: 400, headers: CORS });
        }

        const result = await offerEnterpriseUpgrade(env, {
          userId: targetUserId,
          tierId,
          note,
        });

        return Response.json(result, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'enterprise_offer_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/enterprise-request') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const rate = await checkRateLimit(env, request, 'enterprise-request', { limit: 8, windowSec: 3600 });
        if (!rate.ok) {
          return rateLimitedResponse(CORS);
        }

        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const body = await request.json().catch(() => ({}));
        const result = await submitEnterpriseRequest(env, user.id, body.note || '');
        return Response.json(result, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'enterprise_request_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/enterprise-offer') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        if (request.method === 'GET') {
          const payload = await getEnterpriseOfferForUser(env, user.id);
          return Response.json(payload, { headers: CORS });
        }

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const action = body.action;

          if (action === 'accept') {
            const result = await acceptEnterpriseOffer(env, user.id);
            return Response.json(result, { headers: CORS });
          }

          if (action === 'decline') {
            const result = await declineEnterpriseOffer(env, user.id);
            return Response.json(result, { headers: CORS });
          }

          return Response.json({ error: 'action must be accept or decline' }, { status: 400, headers: CORS });
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'enterprise_offer_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/health' || url.pathname === '/api/auth/status') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }
      if (url.pathname === '/api/health') {
        return Response.json(
          {
            status: 'ok',
            service: 'simple-stream-core',
            ...publicAuthHealth(env),
          },
          { headers: CORS }
        );
      }
      const { user, reason } = await verifyAdminUser(request, env, verifySupabaseUser);
      if (user) {
        return Response.json(adminAuthConfigStatus(env), { headers: CORS });
      }
      if (reason === 'forbidden' || reason === 'mfa_required' || reason === 'access_required' || reason === 'missing_access_jwt' || reason === 'invalid_access_jwt') {
        return adminDeniedResponse(reason);
      }
      return Response.json(publicAuthHealth(env), { headers: CORS });
    }

    if (url.pathname === '/api/turnstile/verify') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const rate = await checkRateLimit(env, request, 'turnstile-verify', { limit: 20, windowSec: 60 });
        if (!rate.ok) {
          return rateLimitedResponse(CORS);
        }

        const body = await request.json().catch(() => ({}));
        const ip =
          request.headers.get('cf-connecting-ip') ||
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown';
        const result = await verifyTurnstileToken(env, body.token, ip);

        if (!result.success) {
          return Response.json(
            { success: false, error: result.error || 'verification_failed' },
            { status: 400, headers: CORS }
          );
        }

        return Response.json({ success: true, skipped: Boolean(result.skipped) }, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { success: false, error: error.message || 'turnstile_verify_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/stripe/webhook') {
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        if (!env.STRIPE_WEBHOOK_SECRET) {
          return Response.json({ error: 'Stripe webhook is not configured' }, { status: 503, headers: CORS });
        }

        const payload = await request.text();
        const signature = request.headers.get('stripe-signature');
        const valid = await verifyStripeWebhookSignature(
          payload,
          signature,
          env.STRIPE_WEBHOOK_SECRET?.trim()
        );

        if (!valid) {
          return Response.json({ error: 'Invalid Stripe signature' }, { status: 400, headers: CORS });
        }

        const event = JSON.parse(payload);
        await handleStripeWebhookEvent(event, env);

        return Response.json({ received: true }, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json({ error: 'stripe_webhook_failed' }, { status: 500, headers: CORS });
      }
    }

    if (url.pathname === '/api/stripe/sync') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const result = await syncUserSubscriptionFromStripe(user, env);
        return Response.json(result, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'stripe_sync_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/stripe/confirm') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const body = await request.json().catch(() => ({}));
        const sessionId = body.sessionId?.trim();
        if (!sessionId) {
          return Response.json({ error: 'sessionId is required' }, { status: 400, headers: CORS });
        }
        const stripeKey = normalizeStripeSecretKey(env.STRIPE_SECRET_KEY);
        if (!stripeKey || !isValidStripeSecretKey(stripeKey)) {
          return Response.json({ error: 'Stripe is not configured' }, { status: 503, headers: CORS });
        }

        const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const session = await response.json();
        if (!response.ok) {
          return Response.json({ error: 'Checkout session not found' }, { status: 404, headers: CORS });
        }

        const ownerId = session.metadata?.user_id || session.client_reference_id;
        if (ownerId !== user.id) {
          return Response.json({ error: 'Forbidden' }, { status: 403, headers: CORS });
        }

        if (session.payment_status !== 'paid') {
          return Response.json({ activated: false, pending: true }, { headers: CORS });
        }

        await activateFromCheckoutSession(session, env);
        return Response.json({ activated: true }, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'confirm_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/stripe/portal') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const body = await request.json().catch(() => ({}));
        const returnUrl = resolveBillingReturnUrl(request, env, body.returnUrl);

        const session = await createBillingPortalSession(user, env, returnUrl);
        return Response.json(session, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'billing_portal_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/subscription/cancel') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const body = await request.json().catch(() => ({}));
        const immediate = body.immediate === true;

        const result = await cancelUserSubscription(user, env, { immediate });
        return Response.json(result, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'subscription_cancel_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/subscription/init') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const rate = await checkRateLimit(env, request, 'subscription-init', { limit: 12, windowSec: 3600 });
        if (!rate.ok) {
          return rateLimitedResponse(CORS);
        }

        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const result = await initUserSubscriptionForUser(env, { user, request });
        return Response.json(
          {
            subscription: result.subscription,
            created: result.created,
          },
          { headers: CORS }
        );
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'subscription_init_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/legal/accept') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const rate = await checkRateLimit(env, request, 'legal-accept', { limit: 30, windowSec: 3600 });
        if (!rate.ok) {
          return rateLimitedResponse(CORS);
        }

        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const body = await request.json().catch(() => ({}));
        const result = await recordLegalAcceptanceEvent(env, {
          user,
          request,
          termsVersion: body.termsVersion,
          privacyVersion: body.privacyVersion,
          acceptanceMethod: body.acceptanceMethod,
        });
        return Response.json(result, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'legal_accept_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/account/delete') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const body = await request.json().catch(() => ({}));
        const confirmPhrase = String(body.confirmPhrase || '').trim().toUpperCase();
        if (confirmPhrase !== 'DELETE') {
          return Response.json(
            { error: 'Type DELETE to confirm account deletion' },
            { status: 400, headers: CORS }
          );
        }

        const result = await deleteUserAccount(user, env);
        return Response.json(result, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'account_delete_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/stripe/checkout') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const rate = await checkRateLimit(env, request, 'stripe-checkout', { limit: 20, windowSec: 3600 });
        if (!rate.ok) {
          return rateLimitedResponse(CORS);
        }

        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        const body = await request.json();
        const { tierId, successUrl, cancelUrl } = body ?? {};
        if (!tierId || !successUrl || !cancelUrl) {
          return Response.json({ error: 'tierId, successUrl, and cancelUrl are required' }, { status: 400, headers: CORS });
        }

        const tier = await fetchSubscriptionTier(tierId, env);
        if (!tier) {
          return Response.json({ error: 'Subscription tier not found' }, { status: 404, headers: CORS });
        }

        const upgrade = await tryUpgradeStripeSubscription(env, user, tier);
        if (upgrade.upgraded) {
          return Response.json(
            {
              upgraded: true,
              tierName: upgrade.tierName,
              subscription: upgrade.subscription,
            },
            { headers: CORS }
          );
        }

        const existingRows = await supabaseSelect(
          env,
          'user_subscriptions',
          `user_id=eq.${user.id}&select=stripe_customer_id`
        );
        const session = await createStripeCheckoutSession(
          {
            tier,
            user,
            successUrl,
            cancelUrl,
            customerId: existingRows?.[0]?.stripe_customer_id || null,
          },
          env
        );

        return Response.json({ url: session.url, sessionId: session.id }, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'checkout_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/stream-keys') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        if (request.method === 'GET') {
          const rows = await supabaseSelect(
            env,
            'stream_keys',
            `user_id=eq.${user.id}&status=neq.revoked&select=*&order=created_at.desc`
          );
          const streamKeys = await Promise.all(
            (rows ?? []).map(async (row) => {
              if (row.cloudflare_input_id) {
                await enableCloudflareLiveInputPlayback(env, row.cloudflare_input_id);
              }
              const synced = await syncStreamKeyConnectivity(env, row);
              return {
                ...synced,
                rtmp_ingest_url: normalizeCloudflareRtmpsIngestUrl(synced.rtmp_ingest_url),
                hls_playback_url:
                  buildHlsPlaybackUrl(env.CLOUDFLARE_STREAM_CUSTOMER_CODE, synced.cloudflare_input_id) ||
                  synced.hls_playback_url,
              };
            })
          );
          const usage = await getUserStreamKeyUsage(env, user.id);
          return Response.json(
            { stream_keys: streamKeys, ...usage },
            { headers: CORS }
          );
        }

        if (request.method === 'POST') {
          try {
            await assertPlatformAccess(env, user.id);
          } catch (error) {
            if (error instanceof SubscriptionAccessError) {
              return subscriptionRequiredResponse();
            }
            throw error;
          }

          const body = await request.json().catch(() => ({}));
          const streamName = (body.stream_name || 'My Stream').trim();
          if (!streamName) {
            return Response.json({ error: 'stream_name is required' }, { status: 400, headers: CORS });
          }

          const [limit, count] = await Promise.all([
            getUserStreamKeyLimit(env, user.id),
            countUserStreamKeys(env, user.id),
          ]);

          if (count >= limit) {
            const limitMessage =
              limit >= 10
                ? 'Stream key limit reached. Contact us at support@simplestreamz.com for Enterprise pricing and custom limits.'
                : `Stream key limit reached (${limit}). Upgrade your plan for more.`;
            return Response.json(
              {
                error: limitMessage,
                code: limit >= 10 ? 'enterprise_required' : 'stream_key_limit',
                limit,
              },
              { status: 403, headers: CORS }
            );
          }

          const cf = await createCloudflareLiveInput(env, streamName);
          const streamKey = await supabaseInsert(env, 'stream_keys', {
            user_id: user.id,
            stream_name: streamName,
            key_value: cf.key_value,
            rtmp_ingest_url: cf.rtmp_ingest_url,
            cloudflare_input_id: cf.cloudflare_input_id,
            hls_playback_url: cf.hls_playback_url,
            status: 'active',
            is_live: false,
            viewer_count: 0,
            total_view_hours: 0,
          });

          return Response.json({ stream_key: streamKey }, { headers: CORS });
        }

        if (request.method === 'DELETE') {
          const keyId = url.searchParams.get('id');
          if (!keyId) {
            return Response.json({ error: 'id is required' }, { status: 400, headers: CORS });
          }

          const rows = await supabaseSelect(
            env,
            'stream_keys',
            `id=eq.${keyId}&user_id=eq.${user.id}&select=*`
          );
          const existing = rows?.[0];
          if (!existing) {
            return Response.json({ error: 'Stream key not found' }, { status: 404, headers: CORS });
          }

          const sermonRows =
            (await supabaseSelect(
              env,
              'sermon_recordings',
              `stream_key_id=eq.${keyId}&select=cloudflare_video_uid`
            )) ?? [];
          for (const row of sermonRows) {
            await deleteCloudflareVideo(env, row.cloudflare_video_uid);
          }
          await supabaseDelete(env, 'sermon_recordings', `stream_key_id=eq.${keyId}`);
          await deleteCloudflareLiveInput(env, existing.cloudflare_input_id);
          await supabaseDelete(env, 'stream_keys', `id=eq.${keyId}`);
          return Response.json({ success: true }, { headers: CORS });
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'stream_key_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/stream-keys/refresh') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        try {
          await assertPlatformAccess(env, user.id);
        } catch (error) {
          if (error instanceof SubscriptionAccessError) {
            return subscriptionRequiredResponse();
          }
          throw error;
        }

        const body = await request.json().catch(() => ({}));
        const keyId = body.id;
        if (!keyId) {
          return Response.json({ error: 'id is required' }, { status: 400, headers: CORS });
        }

        const rows = await supabaseSelect(
          env,
          'stream_keys',
          `id=eq.${keyId}&user_id=eq.${user.id}&select=*`
        );
        const existing = rows?.[0];
        if (!existing) {
          return Response.json({ error: 'Stream key not found' }, { status: 404, headers: CORS });
        }

        await deleteCloudflareLiveInput(env, existing.cloudflare_input_id);
        const cf = await createCloudflareLiveInput(env, existing.stream_name || 'My Stream');
        const updated = await supabaseUpdate(env, 'stream_keys', `id=eq.${keyId}`, {
          key_value: cf.key_value,
          rtmp_ingest_url: cf.rtmp_ingest_url,
          cloudflare_input_id: cf.cloudflare_input_id,
          hls_playback_url: cf.hls_playback_url,
          status: 'active',
        });

        return Response.json({ stream_key: updated }, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'stream_key_refresh_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/embeds') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        if (request.method === 'POST') {
          try {
            await assertPlatformAccess(env, user.id);
          } catch (error) {
            if (error instanceof SubscriptionAccessError) {
              return subscriptionRequiredResponse();
            }
            throw error;
          }

          const body = await request.json().catch(() => ({}));
          const name = (body.name || '').trim();
          const videoSourceType = body.video_source_type || 'youtube';
          const videoSourceUrl = (body.video_source_url || '').trim() || null;
          const streamKeyId = body.stream_key_id || null;

          if (!name) {
            return Response.json({ error: 'name is required' }, { status: 400, headers: CORS });
          }
          if (videoSourceType === 'rtmp' && !streamKeyId) {
            return Response.json({ error: 'stream_key_id is required for RTMP embeds' }, { status: 400, headers: CORS });
          }
          if (videoSourceType === 'youtube' && !videoSourceUrl) {
            return Response.json({ error: 'video_source_url is required for YouTube embeds' }, { status: 400, headers: CORS });
          }

          await assertUserStreamKey(env, user.id, streamKeyId);

          const watermarkPolicy = await resolveOwnerWatermarkPolicy(env, user.id);
          const trackingCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
          const embed = await supabaseInsert(env, 'embed_instances', {
            user_id: user.id,
            tracking_code: trackingCode,
            name,
            video_source_type: videoSourceType,
            video_source_url: videoSourceUrl,
            stream_key_id: streamKeyId,
            is_watermark_enabled: watermarkPolicy.defaultWatermarkEnabled,
            watermark_text: '© Simple Streamz',
            watermark_position: 'bottom_right',
            watermark_size: 'medium',
            watermark_opacity: 0.7,
            is_active: true,
          });

          return Response.json({ embed }, { headers: CORS });
        }

        if (request.method === 'PATCH') {
          const embedId = url.searchParams.get('id');
          if (!embedId) {
            return Response.json({ error: 'id is required' }, { status: 400, headers: CORS });
          }

          const rows = await supabaseSelect(
            env,
            'embed_instances',
            `id=eq.${embedId}&user_id=eq.${user.id}&select=*`
          );
          if (!rows?.[0]) {
            return Response.json({ error: 'Embed not found' }, { status: 404, headers: CORS });
          }

          const body = await request.json().catch(() => ({}));
          const patch = {};
          for (const [key, value] of Object.entries(body)) {
            if (EMBED_PATCH_FIELDS.has(key)) {
              patch[key] = value;
            }
          }

          if ('give_url' in patch) {
            try {
              patch.give_url = patch.give_url ? normalizeGiveUrl(patch.give_url) : null;
            } catch (error) {
              return Response.json({ error: error.message }, { status: 400, headers: CORS });
            }
          }

          if (patch.stream_key_id) {
            await assertUserStreamKey(env, user.id, patch.stream_key_id);
          }

          const watermarkPolicy = await resolveOwnerWatermarkPolicy(env, user.id);
          if (watermarkPolicy.tierRequiresWatermark && 'is_watermark_enabled' in patch) {
            patch.is_watermark_enabled = true;
          }

          let updated;
          try {
            updated = await supabaseUpdate(env, 'embed_instances', `id=eq.${embedId}`, patch);
          } catch (error) {
            const message = String(error?.message || error || '');
            if (
              message.includes('replay_when_offline') ||
              message.includes('holding_title') ||
              message.includes('holding_message') ||
              message.includes('schema cache') ||
              message.includes('PGRST204')
            ) {
              return Response.json(
                {
                  error:
                    'Offline playback settings need a database update. Run scripts/apply-embed-offline-playback.sql in the Supabase SQL Editor, then try again.',
                  code: 'schema_migration_required',
                },
                { status: 503, headers: CORS }
              );
            }
            throw error;
          }
          return Response.json({ embed: updated }, { headers: CORS });
        }

        if (request.method === 'DELETE') {
          const embedId = url.searchParams.get('id');
          if (!embedId) {
            return Response.json({ error: 'id is required' }, { status: 400, headers: CORS });
          }

          const rows = await supabaseSelect(
            env,
            'embed_instances',
            `id=eq.${embedId}&user_id=eq.${user.id}&select=id`
          );
          if (!rows?.[0]) {
            return Response.json({ error: 'Embed not found' }, { status: 404, headers: CORS });
          }

          await supabaseDelete(env, 'embed_instances', `id=eq.${embedId}`);
          return Response.json({ success: true }, { headers: CORS });
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'embed_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/embed/config') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const code = url.searchParams.get('code')?.trim();
        if (!code) {
          return Response.json({ error: 'code is required' }, { status: 400, headers: CORS });
        }

        const rate = await checkRateLimit(env, request, 'embed-config', { limit: 45, windowSec: 60 });
        if (!rate.ok) {
          return rateLimitedResponse(CORS);
        }

        const referer = request.headers.get('referer') || request.headers.get('origin') || '';
        const origin = request.headers.get('origin') || '';
        const viewHost = url.searchParams.get('host')?.trim().toLowerCase() || '';
        const secFetchSite = request.headers.get('sec-fetch-site') || '';
        const result = await resolveEmbedConfig(env, code, referer, viewHost, {
          origin,
          secFetchSite,
        });
        if (result.error) {
          return Response.json({ error: result.error }, { status: result.status, headers: CORS });
        }
        return Response.json(result.body, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json({ error: 'embed_config_failed' }, { status: 500, headers: CORS });
      }
    }

    if (url.pathname === '/api/embed/view') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const rate = await checkRateLimit(env, request, 'embed-view', { limit: 30, windowSec: 60 });
        if (!rate.ok) {
          return rateLimitedResponse(CORS);
        }

        const body = await request.json().catch(() => ({}));
        if (body.tracking_code) {
          await recordEmbedView(env, body.tracking_code);
        }
        return Response.json({ success: true }, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json({ error: 'embed_view_failed' }, { status: 500, headers: CORS });
      }
    }

    if (url.pathname === '/api/sermons/usage') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        try {
          await assertPlatformAccess(env, user.id);
        } catch (error) {
          if (error instanceof SubscriptionAccessError) {
            return subscriptionRequiredResponse();
          }
          throw error;
        }

        const payload = await getSermonRetentionUsage(env, user.id);
        return Response.json(payload, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'sermon_usage_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/sermons') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        try {
          await assertPlatformAccess(env, user.id);
        } catch (error) {
          if (error instanceof SubscriptionAccessError) {
            return subscriptionRequiredResponse();
          }
          throw error;
        }

        if (request.method === 'GET') {
          const payload = await listUserSermonRecordings(env, user.id);
          return Response.json(payload, { headers: CORS });
        }

        if (request.method === 'DELETE') {
          const recordingId = url.searchParams.get('id');
          if (!recordingId) {
            return Response.json({ error: 'id is required' }, { status: 400, headers: CORS });
          }
          const result = await deleteSermonRecording(env, user.id, recordingId);
          return Response.json(result, { headers: CORS });
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'sermons_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/sermons/download') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        try {
          await assertPlatformAccess(env, user.id);
        } catch (error) {
          if (error instanceof SubscriptionAccessError) {
            return subscriptionRequiredResponse();
          }
          throw error;
        }

        const recordingId = url.searchParams.get('id');
        if (!recordingId) {
          return Response.json({ error: 'id is required' }, { status: 400, headers: CORS });
        }

        const result = await prepareSermonDownload(env, user.id, recordingId);
        const deliver = url.searchParams.get('deliver') === '1';

        if (deliver) {
          if (result.status !== 'ready' || !result.url) {
            return Response.json(
              {
                status: result.status,
                percentComplete: result.percentComplete ?? null,
                error: 'Download is still preparing',
              },
              { status: result.status === 'inprogress' ? 202 : 409, headers: CORS }
            );
          }

          const cfResponse = await fetch(result.url);
          if (!cfResponse.ok) {
            return Response.json(
              { error: 'Could not retrieve MP4 from storage' },
              { status: 502, headers: CORS }
            );
          }

          const filename = `${String(result.title || 'sermon')
            .replace(/[^a-zA-Z0-9-_ ]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 80) || 'sermon'}.mp4`;

          const headers = new Headers(CORS);
          headers.set(
            'Content-Type',
            cfResponse.headers.get('Content-Type') || 'application/octet-stream'
          );
          headers.set('Content-Disposition', `attachment; filename="${filename}"`);
          const contentLength = cfResponse.headers.get('Content-Length');
          if (contentLength) headers.set('Content-Length', contentLength);

          return new Response(cfResponse.body, { status: 200, headers });
        }

        return Response.json(result, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'sermon_download_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/platform/launch') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const config = await getPublicLaunchConfig(env);
        return Response.json(config, { headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'launch_config_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/admin/platform-settings') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      try {
        const { user, reason } = await verifyAdminUser(request, env, verifySupabaseUser);
        if (!user) {
          if (reason === 'forbidden' || reason === 'mfa_required' || reason === 'access_required' || reason === 'missing_access_jwt' || reason === 'invalid_access_jwt') {
            return adminDeniedResponse(reason);
          }
          return unauthorizedResponse(reason);
        }

        if (request.method === 'GET') {
          const config = await getAdminPlatformSettings(env);
          return Response.json(config, { headers: CORS });
        }

        if (request.method === 'PATCH') {
          const body = await request.json().catch(() => ({}));
          const config = await patchAdminPlatformSettings(env, body);
          return Response.json(config, { headers: CORS });
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        const message = String(error?.message || error || '');
        if (message.includes('platform_settings') || message.includes('schema cache')) {
          return Response.json(
            {
              error: 'Platform settings storage is unavailable. Contact support or redeploy the Worker.',
              code: 'platform_settings_unavailable',
            },
            { status: 503, headers: CORS }
          );
        }
        return Response.json(
          { error: error.message || 'platform_settings_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/service-schedule') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        try {
          await assertPlatformAccess(env, user.id);
        } catch (error) {
          if (error instanceof SubscriptionAccessError) {
            return subscriptionRequiredResponse();
          }
          throw error;
        }

        if (request.method === 'GET') {
          const payload = await getUserServiceSchedule(env, user.id);
          return Response.json(payload, { headers: CORS });
        }

        if (request.method === 'PUT') {
          const body = await request.json().catch(() => ({}));
          const payload = await saveUserServiceSchedule(env, user.id, body);
          return Response.json(payload, { headers: CORS });
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'service_schedule_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/stream-alerts') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      try {
        const { user, reason } = await verifySupabaseUser(request, env);
        if (!user) {
          return unauthorizedResponse(reason);
        }

        if (request.method === 'GET') {
          const limit = Number(url.searchParams.get('limit') || 20);
          const payload = await listUserStreamAlerts(env, user.id, { limit });
          return Response.json(payload, { headers: CORS });
        }

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const result = await markStreamAlertsRead(env, user.id, body.alertIds);
          return Response.json(result, { headers: CORS });
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      } catch (error) {
        Sentry.captureException(error);
        return Response.json(
          { error: error.message || 'stream_alerts_failed' },
          { status: 500, headers: CORS }
        );
      }
    }

    if (url.pathname === '/api/youtube-live') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405, headers: CORS });
      }

      const videoId = url.searchParams.get('videoId');
      const playlistId = url.searchParams.get('playlistId');

      const innertubeOptions = { apiKey: env.YOUTUBE_INNERTUBE_KEY };

      try {
        if (playlistId) {
          const items = await resolvePlaylistBroadcasts(playlistId, 10, innertubeOptions);
          const liveNow = items.filter((item) => item.isLiveNow).map((item) => item.id);
          const broadcasts = items.filter((item) => item.isBroadcast).map((item) => item.id);
          return Response.json({ liveNow, broadcasts, items }, { headers: CORS });
        }

        if (videoId) {
          const status = await resolveVideoBroadcast(videoId, innertubeOptions);
          return Response.json({ videoId, ...status }, { headers: CORS });
        }

        return Response.json(
          { error: 'videoId or playlistId required' },
          { status: 400, headers: CORS }
        );
      } catch (error) {
        Sentry.captureException(error);
        return Response.json({ error: 'upstream_failed' }, { status: 502, headers: CORS });
      }
    }

    const response = await env.ASSETS.fetch(request);

    if (url.pathname === '/' || url.pathname.endsWith('.html')) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron || '';
    if (cron === '0 * * * *') {
      ctx.waitUntil(
        runSermonLibraryCron(env).catch((error) => {
          Sentry.captureException(error);
        })
      );
      return;
    }

    ctx.waitUntil(
      runStreamMonitorCron(env).catch((error) => {
        Sentry.captureException(error);
      })
    );
  },
};

export default Sentry.withSentry(
  (env) =>
    env.SENTRY_DSN
      ? {
          dsn: env.SENTRY_DSN,
          tracesSampleRate: 0.1,
          environment: 'production',
        }
      : undefined,
  handler
);
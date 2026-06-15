import * as Sentry from '@sentry/cloudflare';
import {
  resolvePlaylistBroadcasts,
  resolveVideoBroadcast,
} from '../functions/_shared/youtube-innertube.mjs';
import {
  createCloudflareLiveInput,
  deleteCloudflareLiveInput,
} from './_shared/cloudflare-stream.mjs';
import { resolveEmbedConfig, recordEmbedView } from './_shared/embed-config.mjs';
import {
  countUserStreamKeys,
  getUserStreamKeyLimit,
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from './_shared/supabase-admin.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function verifySupabaseUser(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return null;
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
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

async function createStripeCheckoutSession({ tier, user, successUrl, cancelUrl }, env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured');
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
  });

  if (user.email) {
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
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
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

const handler = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/stripe/checkout') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }

      if (request.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const user = await verifySupabaseUser(request, env);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
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

        const session = await createStripeCheckoutSession(
          { tier, user, successUrl, cancelUrl },
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
        const user = await verifySupabaseUser(request, env);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
        }

        if (request.method === 'POST') {
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
            return Response.json(
              { error: `Stream key limit reached (${limit}). Upgrade your plan for more.` },
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
        const user = await verifySupabaseUser(request, env);
        if (!user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
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

    if (url.pathname === '/api/embed/config') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS });
      }
      if (request.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
      }

      try {
        const code = url.searchParams.get('code');
        if (!code) {
          return Response.json({ error: 'code is required' }, { status: 400, headers: CORS });
        }

        const referer = request.headers.get('referer') || request.headers.get('origin') || '';
        const result = await resolveEmbedConfig(env, code, referer);
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
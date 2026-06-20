/**
 * One-shot Worker: inserts Enterprise tier if missing.
 * Run: npx wrangler dev scripts/seed-enterprise-tier.mjs --remote --port 8799
 * Then: curl http://127.0.0.1:8799/
 */
import { supabaseInsert, supabaseSelect } from '../worker/_shared/supabase-admin.mjs';

const ENTERPRISE_TIER = {
  name: 'Enterprise',
  description: 'Custom limits and dedicated support for large organizations',
  monthly_price: 0,
  max_bitrate_mbps: 15,
  max_concurrent_viewers: 5000,
  storage_limit_gb: 250,
  max_stream_keys: 25,
  has_watermark: false,
  support_level: '24_7_chat',
  features: [
    'Custom stream key limits',
    'Dedicated account support',
    'Custom branding',
    'Priority onboarding',
  ],
  sort_order: 4,
  is_active: false,
  cta_label: 'Contact us for pricing',
  is_popular: false,
};

export default {
  async fetch(_request, env) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { ok: false, error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required' },
        { status: 500 }
      );
    }

    const existing = await supabaseSelect(
      env,
      'subscription_tiers',
      'name=eq.Enterprise&select=id,name&limit=1'
    );

    if (existing?.[0]) {
      return Response.json({
        ok: true,
        message: 'Enterprise tier already exists',
        tier: existing[0],
      });
    }

    const tier = await supabaseInsert(env, 'subscription_tiers', ENTERPRISE_TIER);
    return Response.json({ ok: true, message: 'Enterprise tier created', tier });
  },
};
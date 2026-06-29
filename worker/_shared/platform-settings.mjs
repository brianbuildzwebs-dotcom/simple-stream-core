import { supabaseHeaders, supabaseInsert } from './supabase-admin.mjs';

const KV_LAUNCH_OFFER_KEY = 'launch_offer';
const KV_SIMULCAST_KEY = 'simulcast';

export const DEFAULT_LAUNCH_OFFER = {
  active: true,
  headline: 'Launch pricing — limited time',
  body: 'Subscribe now to lock in today’s rate. Stay on your plan and your price stays the same.',
  offerEndsAt: '2026-09-30',
  offerEndsLabel: 'Through September 30, 2026',
  grandfatherNote:
    'Your monthly rate is grandfathered while your paid subscription stays active on the same plan.',
  futurePrices: {
    Basic: 14.99,
    Pro: 39.99,
    Premium: 129.99,
  },
};

export const DEFAULT_SIMULCAST = {
  status: 'coming_soon',
  title: 'Simulcast to Facebook & YouTube',
  body: 'Push your live service to Facebook and YouTube from one dashboard — no second OBS output. In development now for FaithGather and FaithCampus plans.',
  tiers: 'FaithGather+',
};

const ALLOWED_SIMULCAST_STATUSES = new Set(['hidden', 'coming_soon', 'beta', 'live']);

function hasKvStore(env) {
  return Boolean(env.PLATFORM_SETTINGS?.get && env.PLATFORM_SETTINGS?.put);
}

function requireSupabaseUrl(env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!url) {
    throw new Error('SUPABASE_URL is not configured on the Worker');
  }
  return url;
}

function parseSettingValue(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

async function readKvSetting(env, key) {
  if (!hasKvStore(env)) return null;
  const raw = await env.PLATFORM_SETTINGS.get(key);
  return parseSettingValue(raw);
}

async function writeKvSetting(env, key, value) {
  if (!hasKvStore(env)) {
    throw new Error('Platform settings storage is not configured on the Worker');
  }
  await env.PLATFORM_SETTINGS.put(key, JSON.stringify(value));
  return value;
}

async function readSupabaseSetting(env, key) {
  const response = await fetch(
    `${requireSupabaseUrl(env)}/rest/v1/platform_settings?key=eq.${encodeURIComponent(key)}&select=value&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!response.ok) return null;
  const rows = await response.json().catch(() => null);
  if (!rows?.[0]?.value || typeof rows[0].value !== 'object') return null;
  return rows[0].value;
}

async function writeSupabaseSetting(env, key, value) {
  const query = `key=eq.${encodeURIComponent(key)}`;
  const existingResponse = await fetch(
    `${requireSupabaseUrl(env)}/rest/v1/platform_settings?${query}&select=key&limit=1`,
    { headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY) }
  );
  if (!existingResponse.ok) return false;

  const existing = await existingResponse.json().catch(() => null);
  if (existing?.[0]) {
    const response = await fetch(`${requireSupabaseUrl(env)}/rest/v1/platform_settings?${query}`, {
      method: 'PATCH',
      headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY, {
        Prefer: 'return=representation',
      }),
      body: JSON.stringify({ value }),
    });
    return response.ok;
  }

  const inserted = await supabaseInsert(env, 'platform_settings', { key, value });
  return Boolean(inserted);
}

async function readSetting(env, key) {
  const kvValue = await readKvSetting(env, key);
  if (kvValue) return kvValue;
  return readSupabaseSetting(env, key);
}

async function writeSetting(env, key, value) {
  if (hasKvStore(env)) {
    await writeKvSetting(env, key, value);
    await writeSupabaseSetting(env, key, value).catch(() => {});
    return value;
  }

  const wrote = await writeSupabaseSetting(env, key, value);
  if (!wrote) {
    throw new Error(
      'Could not save platform settings. Worker KV is not configured and the Supabase platform_settings table is unavailable.'
    );
  }
  return value;
}

export async function getPublicLaunchConfig(env) {
  const [launchOffer, simulcast] = await Promise.all([
    readSetting(env, KV_LAUNCH_OFFER_KEY),
    readSetting(env, KV_SIMULCAST_KEY),
  ]);

  return {
    launchOffer: { ...DEFAULT_LAUNCH_OFFER, ...(launchOffer || {}) },
    simulcast: { ...DEFAULT_SIMULCAST, ...(simulcast || {}) },
  };
}

export async function getAdminPlatformSettings(env) {
  return getPublicLaunchConfig(env);
}

export async function patchAdminPlatformSettings(env, body = {}) {
  const result = {};

  if (body.launch_offer && typeof body.launch_offer === 'object') {
    const current = (await readSetting(env, KV_LAUNCH_OFFER_KEY)) || {};
    const next = {
      ...DEFAULT_LAUNCH_OFFER,
      ...current,
      ...body.launch_offer,
    };
    if (body.launch_offer.futurePrices) {
      next.futurePrices = { ...DEFAULT_LAUNCH_OFFER.futurePrices, ...body.launch_offer.futurePrices };
    }
    await writeSetting(env, KV_LAUNCH_OFFER_KEY, next);
    result.launchOffer = next;
  }

  if (body.simulcast && typeof body.simulcast === 'object') {
    const current = (await readSetting(env, KV_SIMULCAST_KEY)) || {};
    const next = { ...DEFAULT_SIMULCAST, ...current, ...body.simulcast };
    if (next.status && !ALLOWED_SIMULCAST_STATUSES.has(next.status)) {
      throw new Error('Invalid simulcast status');
    }
    await writeSetting(env, KV_SIMULCAST_KEY, next);
    result.simulcast = next;
  }

  if (!result.launchOffer || !result.simulcast) {
    const fresh = await getPublicLaunchConfig(env);
    return {
      launchOffer: result.launchOffer || fresh.launchOffer,
      simulcast: result.simulcast || fresh.simulcast,
    };
  }

  return result;
}
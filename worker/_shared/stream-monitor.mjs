import { fetchCloudflareLiveInputStatus } from './cloudflare-stream.mjs';
import { sendStreamAlertEmail } from './stream-email.mjs';
import { supabaseInsert, supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

const DISCONNECT_COOLDOWN_MS = 15 * 60 * 1000;
const MIN_LIVE_MS = 60 * 1000;
const MONITOR_LOOKBACK_MS = 4 * 60 * 60 * 1000;

async function fetchAuthUserEmail(env, userId) {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  if (!baseUrl || !userId) return null;

  const response = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!response.ok) return null;
  const user = await response.json();
  return user?.email ?? null;
}

async function recordDisconnectAlert(env, row) {
  const streamName = row.stream_name || 'Your stream';
  const message = `${streamName} stopped sending video. Check OBS or your internet connection, then start streaming again.`;

  const alert = await supabaseInsert(env, 'stream_alerts', {
    user_id: row.user_id,
    stream_key_id: row.id,
    stream_name: streamName,
    message,
  });

  const appUrl = env.PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://simplestreamz.io';
  const streamsUrl = `${appUrl}/dashboard/streams`;

  const email = await fetchAuthUserEmail(env, row.user_id);
  if (email) {
    const subject = `${streamName} went offline — Simple Streamz`;
    const text = [
      message,
      '',
      'Open your dashboard to verify stream keys and OBS settings:',
      streamsUrl,
      '',
      'You receive these alerts when a feed disconnects during service.',
    ].join('\n');
    const html = `<p>${message}</p><p><a href="${streamsUrl}">Open Stream Keys</a></p>`;

    const result = await sendStreamAlertEmail(env, { to: email, subject, text, html });
    if (result.sent && alert?.id) {
      await supabaseUpdate(env, 'stream_alerts', `id=eq.${alert.id}`, {
        email_sent_at: new Date().toISOString(),
      });
    }
  }

  return alert;
}

export async function syncStreamKeyConnectivity(env, row) {
  if (!row?.cloudflare_input_id || row.status === 'revoked') {
    return { ...row, is_live: false, alertCreated: false };
  }

  const status = await fetchCloudflareLiveInputStatus(env, row.cloudflare_input_id);
  const connected = Boolean(status.connected);
  const wasLive = Boolean(row.is_live);
  const patch = {};
  let alertCreated = false;

  if (connected !== wasLive) {
    patch.is_live = connected;
  }

  if (connected && !wasLive) {
    patch.last_connected_at = new Date().toISOString();
  }

  if (wasLive && !connected) {
    const lastAlertAt = row.last_disconnect_alert_at ? Date.parse(row.last_disconnect_alert_at) : 0;
    const lastConnectedAt = row.last_connected_at ? Date.parse(row.last_connected_at) : 0;
    const liveLongEnough = lastConnectedAt > 0 && Date.now() - lastConnectedAt >= MIN_LIVE_MS;
    const cooledDown = Date.now() - lastAlertAt >= DISCONNECT_COOLDOWN_MS;

    if (liveLongEnough && cooledDown) {
      await recordDisconnectAlert(env, row);
      patch.last_disconnect_alert_at = new Date().toISOString();
      alertCreated = true;
    }
  }

  if (Object.keys(patch).length > 0) {
    await supabaseUpdate(env, 'stream_keys', `id=eq.${row.id}`, patch);
  }

  return { ...row, ...patch, alertCreated };
}

export async function listStreamKeysToMonitor(env) {
  const cutoff = new Date(Date.now() - MONITOR_LOOKBACK_MS).toISOString();
  const liveRows =
    (await supabaseSelect(
      env,
      'stream_keys',
      'status=eq.active&cloudflare_input_id=not.is.null&is_live=eq.true&select=*&limit=100'
    )) ?? [];

  const recentRows =
    (await supabaseSelect(
      env,
      'stream_keys',
      `status=eq.active&cloudflare_input_id=not.is.null&is_live=eq.false&last_connected_at=gte.${encodeURIComponent(cutoff)}&select=*&limit=100`
    )) ?? [];

  const merged = new Map();
  for (const row of [...liveRows, ...recentRows]) {
    merged.set(row.id, row);
  }
  return [...merged.values()];
}

export async function runStreamMonitorCron(env) {
  const rows = await listStreamKeysToMonitor(env);
  let checked = 0;
  let alerts = 0;

  for (const row of rows) {
    const result = await syncStreamKeyConnectivity(env, row);
    checked += 1;
    if (result.alertCreated) alerts += 1;
  }

  return { checked, alerts, candidates: rows.length };
}

export async function listUserStreamAlerts(env, userId, { limit = 20 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const rows =
    (await supabaseSelect(
      env,
      'stream_alerts',
      `user_id=eq.${userId}&select=id,stream_key_id,stream_name,message,created_at,read_at,email_sent_at&order=created_at.desc&limit=${capped}`
    )) ?? [];

  const unread = rows.filter((row) => !row.read_at).length;
  return { alerts: rows, unread };
}

export async function markStreamAlertsRead(env, userId, alertIds = null) {
  const rows =
    (await supabaseSelect(
      env,
      'stream_alerts',
      `user_id=eq.${userId}&read_at=is.null&select=id`
    )) ?? [];

  const targets = alertIds?.length
    ? rows.filter((row) => alertIds.includes(row.id))
    : rows;

  const readAt = new Date().toISOString();
  for (const row of targets) {
    await supabaseUpdate(env, 'stream_alerts', `id=eq.${row.id}`, { read_at: readAt });
  }

  return { updated: targets.length };
}
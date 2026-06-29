import { supabaseDelete, supabaseInsert, supabaseSelect, supabaseUpdate } from './supabase-admin.mjs';

const DEFAULT_TIMEZONE = 'America/New_York';
const MAX_SLOTS = 12;

function normalizeTimeLocal(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeDayOfWeek(value) {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  return day;
}

function formatTimeLocal(row) {
  const raw = row?.time_local;
  if (!raw) return null;
  const text = String(raw);
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

export async function getUserServiceSchedule(env, userId) {
  const profiles =
    (await supabaseSelect(
      env,
      'profiles',
      `id=eq.${userId}&select=service_timezone&limit=1`
    )) ?? [];
  const timezone = profiles[0]?.service_timezone?.trim() || DEFAULT_TIMEZONE;

  const rows =
    (await supabaseSelect(
      env,
      'service_schedule_slots',
      `user_id=eq.${userId}&select=id,day_of_week,time_local,label,sort_order&order=sort_order.asc,day_of_week.asc,time_local.asc`
    )) ?? [];

  return {
    timezone,
    slots: rows.map((row) => ({
      id: row.id,
      dayOfWeek: row.day_of_week,
      timeLocal: formatTimeLocal(row),
      label: row.label?.trim() || '',
    })),
  };
}

export async function saveUserServiceSchedule(env, userId, payload = {}) {
  const timezone = String(payload.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  const slots = Array.isArray(payload.slots) ? payload.slots.slice(0, MAX_SLOTS) : [];

  const normalized = [];
  for (const slot of slots) {
    const dayOfWeek = normalizeDayOfWeek(slot.dayOfWeek ?? slot.day_of_week);
    const timeLocal = normalizeTimeLocal(slot.timeLocal ?? slot.time_local);
    if (dayOfWeek === null || !timeLocal) continue;
    normalized.push({
      day_of_week: dayOfWeek,
      time_local: `${timeLocal}:00`,
      label: String(slot.label || '').trim().slice(0, 48) || null,
      sort_order: normalized.length,
    });
  }

  await supabaseUpdate(env, 'profiles', `id=eq.${userId}`, {
    service_timezone: timezone,
  });
  await supabaseDelete(env, 'service_schedule_slots', `user_id=eq.${userId}`);

  for (const slot of normalized) {
    await supabaseInsert(env, 'service_schedule_slots', {
      user_id: userId,
      ...slot,
    });
  }

  return getUserServiceSchedule(env, userId);
}

export function serializeScheduleForEmbed(schedule) {
  if (!schedule?.slots?.length) return null;
  return {
    timezone: schedule.timezone || DEFAULT_TIMEZONE,
    preServiceMinutes: 180,
    slots: schedule.slots
      .filter((slot) => slot.timeLocal)
      .map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        timeLocal: slot.timeLocal,
        label: slot.label || null,
      })),
  };
}
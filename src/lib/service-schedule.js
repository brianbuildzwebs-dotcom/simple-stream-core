const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const SERVICE_DAY_OPTIONS = DAY_NAMES.map((label, value) => ({ label, value }));

export const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getTimezoneOffsetMs(date, timeZone) {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zoned = new Date(date.toLocaleString('en-US', { timeZone }));
  return zoned.getTime() - utc.getTime();
}

function datePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    weekday: lookup.weekday,
  };
}

function weekdayToIndex(weekday) {
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

function zonedLocalToDate({ year, month, day, hour, minute }, timeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimezoneOffsetMs(new Date(guess), timeZone);
    guess = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
  }
  return new Date(guess);
}

function slotToDate(timeZone, dayOfWeek, timeLocal, referenceDate, dayOffset = 0) {
  const [hour, minute] = String(timeLocal).split(':').map(Number);
  const probe = new Date(referenceDate.getTime() + dayOffset * 86400000);
  const parts = datePartsInTimeZone(probe, timeZone);
  if (weekdayToIndex(parts.weekday) !== dayOfWeek) return null;
  return zonedLocalToDate(
    { year: parts.year, month: parts.month, day: parts.day, hour, minute },
    timeZone
  );
}

export function getNextServiceSlot(schedule, now = new Date()) {
  if (!schedule?.slots?.length || !schedule.timezone) return null;

  const candidates = [];
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    for (const slot of schedule.slots) {
      const startsAt = slotToDate(
        schedule.timezone,
        slot.dayOfWeek,
        slot.timeLocal,
        now,
        dayOffset
      );
      if (!startsAt || startsAt <= now) continue;
      candidates.push({
        ...slot,
        startsAt,
      });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.startsAt - b.startsAt);
  const next = candidates[0];
  const msUntil = next.startsAt.getTime() - now.getTime();
  const preWindowMs = (schedule.preServiceMinutes || 180) * 60 * 1000;

  return {
    label: next.label || null,
    dayOfWeek: next.dayOfWeek,
    timeLocal: next.timeLocal,
    startsAt: next.startsAt,
    msUntil,
    withinPreWindow: msUntil <= preWindowMs,
  };
}

export function formatCountdown(msUntil) {
  const totalSeconds = Math.max(0, Math.floor(msUntil / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${minutes}:${pad2(seconds)}`;
}

export function formatServiceStartLabel(slot, timeZone, { includeDate = true } = {}) {
  if (!slot?.startsAt) return null;
  const day = DAY_NAMES[slot.dayOfWeek] || 'Service';
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone,
    ...(includeDate
      ? { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { hour: 'numeric', minute: '2-digit' }),
  }).format(slot.startsAt);
  const prefix = slot.label?.trim() || day;
  return includeDate ? `${prefix} · ${when}` : `${prefix} · ${when}`;
}

export function buildScheduleHoldingLine(schedule, now = new Date()) {
  const next = getNextServiceSlot(schedule, now);
  if (!next) return null;

  const label = formatServiceStartLabel(next, schedule.timezone);
  if (next.withinPreWindow) {
    return {
      headline: label,
      countdown: formatCountdown(next.msUntil),
      detail: 'Starting soon — video begins automatically when we go live.',
    };
  }

  return {
    headline: `Next service: ${label}`,
    countdown: null,
    detail: 'Video begins automatically when we go live.',
  };
}
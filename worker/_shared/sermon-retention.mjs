export const RETENTION_BY_TIER = {
  Basic: { retentionDays: 30, maxRecordings: 4 },
  Pro: { retentionDays: 90, maxRecordings: 12 },
  Premium: { retentionDays: 365, maxRecordings: 52 },
  Enterprise: { retentionDays: 365, maxRecordings: 100 },
};

export const DEFAULT_RETENTION = { retentionDays: 30, maxRecordings: 4 };

const WARNING_PERCENT = 80;
const EXPIRY_SOON_DAYS = 7;

function sortNewestFirst(recordings) {
  return [...(recordings || [])].sort(
    (a, b) => Date.parse(b.recorded_at || 0) - Date.parse(a.recorded_at || 0)
  );
}

function daysSince(isoDate, nowMs = Date.now()) {
  if (!isoDate) return 0;
  return Math.max(0, (nowMs - Date.parse(isoDate)) / 86400000);
}

function daysUntilRetentionExpiry(isoDate, retentionDays, nowMs = Date.now()) {
  const ageDays = daysSince(isoDate, nowMs);
  return Math.max(0, retentionDays - ageDays);
}

export function buildRetentionUsage(recordings, policy, now = new Date()) {
  const nowMs = now.getTime();
  const sorted = sortNewestFirst(recordings);
  const usedCount = sorted.length;
  const maxRecordings = policy.maxRecordings;
  const retentionDays = policy.retentionDays;
  const cutoffMs = nowMs - retentionDays * 86400000;

  const percentUsed =
    maxRecordings > 0 ? Math.min(100, Math.round((usedCount / maxRecordings) * 100)) : 0;

  const atCapacity = usedCount >= maxRecordings;
  const nearingCapacity = !atCapacity && percentUsed >= WARNING_PERCENT;

  const expiredByAge = sorted.filter((row) => Date.parse(row.recorded_at) < cutoffMs);
  const expiringSoon = sorted.filter(
    (row) =>
      Date.parse(row.recorded_at) >= cutoffMs &&
      daysUntilRetentionExpiry(row.recorded_at, retentionDays, nowMs) <= EXPIRY_SOON_DAYS
  );

  const oldest = sorted[sorted.length - 1] || null;
  const nextCountRemoval =
    atCapacity && oldest
      ? {
          id: oldest.id,
          title: oldest.title,
          recorded_at: oldest.recorded_at,
          reason: 'count',
        }
      : null;

  let status = 'ok';
  if (atCapacity || expiredByAge.length > 0) {
    status = 'full';
  } else if (nearingCapacity || expiringSoon.length > 0) {
    status = 'warning';
  }

  const messages = [];
  if (atCapacity) {
    messages.push(
      `You are using all ${maxRecordings} recording slots on your plan. When a new service is recorded, your oldest sermon is removed automatically and cannot be recovered.`
    );
  } else if (nearingCapacity) {
    messages.push(
      `You are using ${usedCount} of ${maxRecordings} recording slots. Download sermons you want to keep before you reach your limit.`
    );
  }

  if (expiredByAge.length > 0) {
    messages.push(
      `${expiredByAge.length} recording${expiredByAge.length === 1 ? '' : 's'} exceeded the ${retentionDays}-day limit and will be removed on the next sync.`
    );
  } else if (expiringSoon.length > 0) {
    const next = expiringSoon[expiringSoon.length - 1];
    const daysLeft = Math.ceil(daysUntilRetentionExpiry(next.recorded_at, retentionDays, nowMs));
    messages.push(
      `"${next.title}" expires in about ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Download it if you want to keep a copy.`
    );
  }

  if (nextCountRemoval) {
    messages.push(
      `Next automatic removal when a new service is recorded: "${nextCountRemoval.title}".`
    );
  }

  return {
    usedCount,
    maxRecordings,
    retentionDays,
    percentUsed,
    slotsLabel: `${usedCount} of ${maxRecordings} recordings`,
    status,
    atCapacity,
    nearingCapacity,
    nextCountRemoval,
    expiredByAge: expiredByAge.map((row) => ({
      id: row.id,
      title: row.title,
      recorded_at: row.recorded_at,
    })),
    expiringSoon: expiringSoon.map((row) => ({
      id: row.id,
      title: row.title,
      recorded_at: row.recorded_at,
      daysLeft: Math.ceil(daysUntilRetentionExpiry(row.recorded_at, retentionDays, nowMs)),
    })),
    warningMessages: messages,
    actionRequired: status !== 'ok',
    deletePolicy:
      'Older recordings are removed automatically when you exceed your plan limit or retention period. Deleted sermons cannot be recovered — download anything you want to keep.',
  };
}

export function buildRetentionSummary(policy) {
  return {
    tierName: policy.tierName,
    retentionDays: policy.retentionDays,
    maxRecordings: policy.maxRecordings,
    summary: `Keeps your ${policy.maxRecordings} most recent services for up to ${policy.retentionDays} days.`,
  };
}
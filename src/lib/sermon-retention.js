/** Mirrors worker/_shared/sermon-retention.mjs for pricing and dashboard copy. */

export const SERMON_RETENTION_BY_TIER = {
  Basic: { retentionDays: 30, maxRecordings: 4, label: 'FaithStart' },
  Pro: { retentionDays: 90, maxRecordings: 12, label: 'FaithGather' },
  Premium: { retentionDays: 365, maxRecordings: 52, label: 'FaithCampus' },
  Enterprise: { retentionDays: 365, maxRecordings: 100, label: 'Enterprise' },
};

export function getSermonRetentionFeatureLabel(tierName) {
  const policy = SERMON_RETENTION_BY_TIER[tierName];
  if (!policy) {
    return 'Automatic sermon recording with plan retention limits';
  }
  return `Sermon library — ${policy.maxRecordings} recordings, ${policy.retentionDays}-day retention`;
}

export function retentionStatusTone(status) {
  if (status === 'full') return 'destructive';
  if (status === 'warning') return 'warning';
  return 'info';
}
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRetentionUsage } from './sermon-retention.mjs';

const policy = { retentionDays: 90, maxRecordings: 12, tierName: 'Pro' };

function recording(id, daysAgo) {
  const recorded_at = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return { id, title: `Service ${id}`, recorded_at };
}

test('buildRetentionUsage reports ok when under limits', () => {
  const usage = buildRetentionUsage([recording('a', 1), recording('b', 2)], policy);
  assert.equal(usage.status, 'ok');
  assert.equal(usage.slotsLabel, '2 of 12 recordings');
  assert.equal(usage.percentUsed, 17);
});

test('buildRetentionUsage warns when nearing capacity', () => {
  const rows = Array.from({ length: 10 }, (_, index) => recording(`id-${index}`, index + 1));
  const usage = buildRetentionUsage(rows, policy);
  assert.equal(usage.status, 'warning');
  assert.equal(usage.nearingCapacity, true);
  assert.match(usage.warningMessages[0], /10 of 12/);
});

test('buildRetentionUsage flags full capacity and names next removal target', () => {
  const rows = Array.from({ length: 12 }, (_, index) => recording(`id-${index}`, index + 1));
  const usage = buildRetentionUsage(rows, policy);
  assert.equal(usage.status, 'full');
  assert.equal(usage.atCapacity, true);
  assert.equal(usage.nextCountRemoval?.id, 'id-11');
  assert.equal(
    usage.warningMessages.some((msg) => msg.includes('oldest sermon')),
    true
  );
});

test('buildRetentionUsage flags recordings past retention age', () => {
  const usage = buildRetentionUsage([recording('old', 100)], policy);
  assert.equal(usage.status, 'full');
  assert.equal(usage.expiredByAge.length, 1);
});
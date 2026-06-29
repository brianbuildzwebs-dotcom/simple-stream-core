import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from './rate-limit.mjs';

test('checkRateLimit fails open without KV', async () => {
  const request = new Request('https://simplestreamz.io/api/test', {
    headers: { 'cf-connecting-ip': '203.0.113.10' },
  });
  const result = await checkRateLimit({}, request, 'test-bucket', { limit: 2, windowSec: 60 });
  assert.equal(result.ok, true);
});

test('checkRateLimit enforces limit with KV', async () => {
  const store = new Map();
  const kv = {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };

  const request = new Request('https://simplestreamz.io/api/test', {
    headers: { 'cf-connecting-ip': '203.0.113.11' },
  });
  const env = { PLATFORM_SETTINGS: kv };

  const first = await checkRateLimit(env, request, 'unit-test', { limit: 2, windowSec: 60 });
  const second = await checkRateLimit(env, request, 'unit-test', { limit: 2, windowSec: 60 });
  const third = await checkRateLimit(env, request, 'unit-test', { limit: 2, windowSec: 60 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
});
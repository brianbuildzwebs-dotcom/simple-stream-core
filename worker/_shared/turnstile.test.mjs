import test from 'node:test';
import assert from 'node:assert/strict';
import { turnstileConfigured, verifyTurnstileToken } from './turnstile.mjs';

test('turnstileConfigured is false without secret', () => {
  assert.equal(turnstileConfigured({}), false);
  assert.equal(turnstileConfigured({ TURNSTILE_SECRET_KEY: '  ' }), false);
  assert.equal(turnstileConfigured({ TURNSTILE_SECRET_KEY: 'secret' }), true);
});

test('verifyTurnstileToken skips when secret is unset', async () => {
  const result = await verifyTurnstileToken({}, '');
  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
});

test('verifyTurnstileToken rejects missing token when configured', async () => {
  const result = await verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'test-secret' }, '');
  assert.equal(result.success, false);
  assert.equal(result.error, 'missing_token');
});
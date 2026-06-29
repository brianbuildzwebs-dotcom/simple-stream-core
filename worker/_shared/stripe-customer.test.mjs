import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBillingReturnUrl } from './stripe-customer.mjs';

test('resolveBillingReturnUrl prefers PUBLIC_APP_URL over workers.dev', () => {
  const request = new Request('https://simple-stream-core.brianbuildzwebs.workers.dev/api/stripe/portal');
  const url = resolveBillingReturnUrl(
    request,
    { PUBLIC_APP_URL: 'https://simplestreamz.io' },
    'https://simple-stream-core.brianbuildzwebs.workers.dev/dashboard/profile/billing-return'
  );
  assert.equal(url, 'https://simplestreamz.io/dashboard/profile?billing=return');
});

test('resolveBillingReturnUrl keeps custom production return URL', () => {
  const request = new Request('https://simplestreamz.io/api/stripe/portal');
  const url = resolveBillingReturnUrl(
    request,
    { PUBLIC_APP_URL: 'https://simplestreamz.io' },
    'https://simplestreamz.io/dashboard/profile?billing=return'
  );
  assert.equal(url, 'https://simplestreamz.io/dashboard/profile?billing=return');
});
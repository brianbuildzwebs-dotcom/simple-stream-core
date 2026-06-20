export function normalizeStripeSecretKey(value) {
  return value?.replace(/^\uFEFF/, '').trim() ?? '';
}

export function isValidStripeSecretKey(value) {
  const key = normalizeStripeSecretKey(value);
  return /^sk_(test|live)_/.test(key);
}
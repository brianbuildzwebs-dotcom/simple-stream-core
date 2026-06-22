export function normalizeGiveUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error('Enter a valid give link (https://your-church-giving-page)');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Give link must use HTTPS for viewer safety');
  }

  return parsed.href;
}

export function isGiveLinkConfigured(enabled, url) {
  if (enabled !== true) return false;
  try {
    return Boolean(normalizeGiveUrl(url || ''));
  } catch {
    return false;
  }
}
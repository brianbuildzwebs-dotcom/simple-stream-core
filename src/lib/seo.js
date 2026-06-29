import { APP_NAME, OG_IMAGE_URL, SITE_URL } from '@/lib/brand';

const DEFAULT_TITLE = `${APP_NAME} — Church live streaming on your website`;
const DEFAULT_DESCRIPTION =
  'Live church streaming on your website. One embed code, OBS-ready RTMP, family-safe chat, and analytics. 10-day free trial — no credit card.';

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return SITE_URL;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

export function setPageMeta({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = OG_IMAGE_URL,
  noindex = false,
} = {}) {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  document.title = title;

  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: noindex ? 'noindex, nofollow' : 'index, follow',
  });

  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: description,
  });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: APP_NAME });

  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: description,
  });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });

  upsertLink('canonical', url);
}
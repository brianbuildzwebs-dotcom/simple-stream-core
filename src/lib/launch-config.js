/** Default launch marketing — overridden by /api/platform/launch when platform_settings exists. */

export const DEFAULT_LAUNCH_OFFER = {
  active: true,
  headline: 'Launch pricing — limited time',
  body: 'Subscribe now to lock in today’s rate. Stay on your plan and your price stays the same.',
  offerEndsAt: '2026-09-30',
  offerEndsLabel: 'Through September 30, 2026',
  grandfatherNote:
    'Your monthly rate is grandfathered while your paid subscription stays active on the same plan.',
  futurePrices: {
    Basic: 14.99,
    Pro: 39.99,
    Premium: 129.99,
  },
};

export const DEFAULT_SIMULCAST = {
  status: 'coming_soon',
  title: 'Simulcast to Facebook & YouTube',
  body: 'Push your live service to Facebook and YouTube from one dashboard — no second OBS output. In development now for FaithGather and FaithCampus plans.',
  tiers: 'FaithGather+',
};

export const SIMULCAST_STATUSES = [
  { value: 'hidden', label: 'Hidden — do not show in dashboard' },
  { value: 'coming_soon', label: 'Coming soon — teaser visible' },
  { value: 'beta', label: 'Beta — teaser shows early access' },
  { value: 'live', label: 'Live — feature enabled (when built)' },
];

export function formatLaunchPrice(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  return `$${Number(amount).toFixed(2).replace(/\.00$/, '')}`;
}

export function getFutureTierPrice(tierName, launchOffer) {
  const prices = launchOffer?.futurePrices || DEFAULT_LAUNCH_OFFER.futurePrices;
  return prices?.[tierName] ?? null;
}

export function launchOfferIsActive(launchOffer, now = new Date()) {
  if (!launchOffer?.active) return false;
  if (!launchOffer.offerEndsAt) return true;
  const end = Date.parse(`${launchOffer.offerEndsAt}T23:59:59`);
  if (Number.isNaN(end)) return true;
  return now.getTime() <= end;
}
import { getSermonRetentionFeatureLabel } from '@/lib/sermon-retention';

/**
 * Church-facing labels for subscription tiers (DB names stay Basic / Pro / Premium).
 */

const CHURCH_PLAN_BY_TIER_NAME = {
  Basic: {
    displayName: 'FaithStart',
    tagline: 'One room, one website, Sunday ready',
    badge: null,
    idealFor: 'Small churches getting started',
    embedLabel: 'Embed on your church website',
    streamKeyLabel: (n) =>
      n === 1
        ? '1 live feed (all your services reuse it)'
        : `${n} live feeds at once`,
    highlights: ['OBS-ready in minutes', 'View tracking per embed', 'Automatic recording'],
  },
  Pro: {
    displayName: 'FaithGather',
    tagline: 'The full Sunday package most churches need',
    badge: 'Best for churches',
    idealFor: 'Sunday School, Morning, Evening, and Midweek — one dashboard',
    embedLabel: 'Unlimited embeds on your site',
    streamKeyLabel: (n) =>
      `${n} simultaneous live feeds (e.g. sanctuary + Sunday School)`,
    highlights: [
      'Domain lock for your church website',
      'Simulcast to Facebook & YouTube (coming soon)',
      'Priority support when Sunday matters',
      'Sunday setup guide in dashboard',
    ],
  },
  Premium: {
    displayName: 'FaithCampus',
    tagline: 'Multi-campus, conferences, and high volume',
    badge: 'Multi-campus',
    idealFor: 'Growing churches and broadcast teams',
    embedLabel: 'Unlimited embeds across campuses',
    streamKeyLabel: (n) => `${n} simultaneous live feeds`,
    highlights: [
      'Simulcast to Facebook & YouTube (coming soon)',
      'Custom branding on the player',
      'Dedicated support channel',
      'Highest viewer limits',
    ],
  },
};

export function getChurchPlanPresentation(tier) {
  const name = tier?.name || '';
  const preset = CHURCH_PLAN_BY_TIER_NAME[name] || null;
  const streamKeys = tier?.max_stream_keys || 1;

  if (!preset) {
    return {
      displayName: name || 'Plan',
      tagline: tier?.description || '',
      badge: tier?.is_popular ? 'Popular' : null,
      idealFor: '',
      featureRows: buildDefaultFeatureRows(tier),
    };
  }

  return {
    displayName: preset.displayName,
    tagline: preset.tagline,
    badge: preset.badge || (tier?.is_popular ? 'Most popular' : null),
    idealFor: preset.idealFor,
    featureRows: [
      preset.streamKeyLabel(streamKeys),
      preset.embedLabel,
      getSermonRetentionFeatureLabel(name),
      `${(tier?.max_concurrent_viewers || 0).toLocaleString()} concurrent viewers`,
      tier?.has_watermark ? 'Watermark on your player' : 'No watermark on your player',
      'Live chat + moderation',
      ...preset.highlights,
    ],
  };
}

function buildDefaultFeatureRows(tier) {
  const keys = tier?.max_stream_keys || 1;
  return [
    `${keys} stream key${keys > 1 ? 's' : ''}`,
    `${(tier?.max_concurrent_viewers || 0).toLocaleString()} concurrent viewers`,
    tier?.has_watermark ? 'Watermark on videos' : 'No watermark',
  ];
}

export const CHURCH_VALUE_PROPS = [
  {
    title: 'One embed, every service',
    body: 'Paste your player once. Reuse the same stream key for 9am, 11am, and Wednesday — your website code never changes.',
  },
  {
    title: 'Only pay for parallel streams',
    body: 'Need sanctuary + Sunday School live at the same time? Use two feeds. One service at a time? One key is enough.',
  },
  {
    title: 'Safe chat for your congregation',
    body: 'Turn chat off during worship, moderate messages, and ban troublemakers — built for church volunteers.',
  },
];

/** Shown on pricing — high perceived value, low marginal cost to you. */
export const INCLUDED_EVERY_PLAN = [
  'OBS / vMix RTMP ingest (Cloudflare-backed)',
  'Embeddable player for your church website',
  'Live chat, moderation, and optional Give button',
  'Custom holding screen while offline',
  'Automatic service recording in the background',
  'View and watch-time analytics per embed',
  'WordPress-friendly embed code',
  '10-day free trial — no credit card required',
  'Stream drop alerts when your feed disconnects',
  'Sermon library with MP4 download (plan retention limits)',
];

export const VALUE_ANCHOR = {
  headline: 'Enterprise-style streaming without enterprise pricing',
  body:
    'Many church platforms start at $75–150/mo for a single campus. Simple Streamz includes chat, embeds, moderation, and OBS-ready streaming from $9.99/mo — because you should not rebuild your website every Sunday.',
  comparison: [
    { label: 'Typical church platform entry', value: '$75+/mo' },
    { label: 'FaithGather (most churches)', value: '$29.99/mo' },
    { label: 'Extra stream keys', value: 'Only when rooms are live at once' },
  ],
};

export const CHURCH_FAQ = [
  {
    q: 'Do I need a new embed for every service?',
    a: 'No. One embed on your website works for every service. You only need extra stream keys when two rooms are live at the same time.',
  },
  {
    q: 'What happens on my website before service?',
    a: 'Visitors tap to open the player, can chat while they wait, and see a holding screen you customize in Embed Manager. Video starts automatically when you go live — no page refresh needed.',
  },
  {
    q: 'Do you store our sermon videos?',
    a: 'Every service is recorded automatically. Open Sermon Library to play or download MP4 files. Each plan keeps a set number of recent services for a set time (FaithStart: 4 / 30 days, FaithGather: 12 / 90 days, FaithCampus: 52 / 1 year). When you are at your limit, the oldest recording is removed automatically when a new service is saved — download anything you want to keep forever. Turn on “Show last service when offline” in Embed Manager to replay the latest recording on your website.',
  },
  {
    q: 'Will this work with WordPress?',
    a: 'Yes. Copy the embed code and paste it into any page, widget, or HTML block.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. Start with a 10-day free trial — no credit card. Cancel anytime.',
  },
  {
    q: 'What does launch pricing mean?',
    a: 'During our launch period, you may see a higher planned price crossed out next to today’s rate. Subscribe now and your monthly price stays the same while you remain on that paid plan. If you cancel and sign up again later, current pricing applies.',
  },
  {
    q: 'When is simulcast to Facebook and YouTube available?',
    a: 'Simulcast is in development for FaithGather and FaithCampus plans. Until it launches, use OBS or vMix dual output. Tap “Notify me” on your dashboard to get an email when it is ready.',
  },
];
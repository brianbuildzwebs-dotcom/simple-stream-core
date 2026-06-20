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
    highlights: ['OBS-ready in minutes', 'View tracking per embed'],
  },
  Pro: {
    displayName: 'FaithGather',
    tagline: 'The full Sunday package most churches need',
    badge: 'Best for churches',
    idealFor: 'Sunday School, Morning, Evening, and Midweek — one dashboard',
    embedLabel: 'Unlimited embeds on your site',
    streamKeyLabel: (n) =>
      `${n} simultaneous live feeds (e.g. sanctuary + Sunday School)`,
    highlights: ['Domain lock for your church website', 'Priority support when Sunday matters'],
  },
  Premium: {
    displayName: 'FaithCampus',
    tagline: 'Multi-campus, conferences, and high volume',
    badge: 'Multi-campus',
    idealFor: 'Growing churches and broadcast teams',
    embedLabel: 'Unlimited embeds across campuses',
    streamKeyLabel: (n) => `${n} simultaneous live feeds`,
    highlights: ['Custom branding on the player', 'Dedicated support channel'],
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
    a: 'Live streaming is included on every plan. Services are recorded automatically in the background. A sermon library with on-demand replays and uploads is coming soon — you are not paying extra for storage today.',
  },
  {
    q: 'Will this work with WordPress?',
    a: 'Yes. Copy the embed code and paste it into any page, widget, or HTML block.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. Start with a 10-day free trial — no credit card. Cancel anytime.',
  },
];
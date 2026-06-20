import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand';

export const ENTERPRISE_TIER_NAME = 'Enterprise';
export const PREMIUM_MAX_STREAM_KEYS = 10;

export const ENTERPRISE_PLAN = {
  name: ENTERPRISE_TIER_NAME,
  description:
    'Custom limits, SLAs, and dedicated onboarding for churches, brands, and broadcast teams.',
  features: [
    'Custom stream key limits',
    'Dedicated account support',
    'Custom branding & domains',
    'Priority onboarding',
  ],
};

export function enterpriseMailto(subject = 'Enterprise plan inquiry') {
  const body = [
    `Hi ${APP_NAME} team,`,
    '',
    "I'm interested in Enterprise pricing and custom stream key limits.",
    '',
    'Organization:',
    'Estimated concurrent viewers:',
    'Number of stream keys needed:',
  ].join('\n');

  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

export function isAtMaxSelfServeStreamKeyLimit(keyLimit, plan) {
  if (keyLimit >= PREMIUM_MAX_STREAM_KEYS) return true;
  if (plan?.name === 'Premium') return true;
  return false;
}

export function hasEnterpriseRequest(subscription) {
  return Boolean(subscription?.enterprise_requested_at);
}

export function hasPendingEnterpriseOffer(subscription) {
  return Boolean(subscription?.enterprise_offer_tier_id);
}

export function isActiveEnterprisePlan(subscription) {
  if (hasPendingEnterpriseOffer(subscription)) return false;
  return (
    subscription?.tier_name === ENTERPRISE_TIER_NAME &&
    (subscription?.billing_managed_by === 'manual' ||
      subscription?.payment_method === 'manual_admin')
  );
}

export function needsEnterpriseOfferAttention(subscription) {
  if (!hasEnterpriseRequest(subscription)) return false;
  if (subscription?.enterprise_offer_tier_id) return false;
  if (subscription?.tier_name === 'Enterprise' && subscription?.billing_managed_by === 'manual') {
    return false;
  }
  return true;
}

export function streamKeyLimitMessage(keyLimit, plan) {
  if (isAtMaxSelfServeStreamKeyLimit(keyLimit, plan)) {
    return {
      title: 'Stream key limit reached',
      description: `You've used all ${keyLimit} stream keys on your plan.`,
      cta: 'Request Enterprise upgrade',
      isEnterprise: true,
      useInAppRequest: true,
    };
  }

  return {
    title: 'Stream key limit reached',
    description: `You've used all ${keyLimit} stream key${keyLimit === 1 ? '' : 's'} on your plan.`,
    cta: 'upgrade your plan',
    href: '/dashboard/profile?tab=upgrade',
    isEnterprise: false,
  };
}
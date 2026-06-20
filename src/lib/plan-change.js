import { ENTERPRISE_TIER_NAME } from '@/lib/enterprise';

export function getPlanChangeAction(tier, currentSortOrder, isPaid) {
  if (!tier) return 'current';
  if (!isPaid) return 'subscribe';
  if (tier.sort_order > currentSortOrder) return 'upgrade';
  if (tier.sort_order < currentSortOrder) return 'downgrade';
  return 'current';
}

export function filterSelfServeTiers(tiers = []) {
  return tiers.filter(
    (tier) =>
      Number(tier.monthly_price) > 0 &&
      tier.name !== ENTERPRISE_TIER_NAME &&
      tier.is_active !== false
  );
}

export function getPlanChangeConfirmCopy({
  action,
  tier,
  planLabel,
  plan,
  streamKeyCount = 0,
}) {
  const price = Number(tier.monthly_price).toFixed(2).replace(/\.00$/, '');
  const targetKeys = tier.max_stream_keys || 1;
  const currentKeys = plan?.max_stream_keys;

  if (action === 'subscribe') {
    return {
      title: `Subscribe to ${tier.name}?`,
      description: `You'll be redirected to Stripe Checkout to start ${tier.name} at $${price}/month. Your trial ends when you subscribe.`,
      confirmLabel: `Subscribe — $${price}/mo`,
    };
  }

  if (action === 'upgrade') {
    return {
      title: `Upgrade to ${tier.name}?`,
      description: `Your plan will change immediately. Stripe prorates the difference on your next invoice — you won't have two subscriptions.`,
      confirmLabel: `Upgrade to ${tier.name}`,
    };
  }

  if (action === 'downgrade') {
    const keyWarning =
      currentKeys != null && streamKeyCount > targetKeys
        ? ` You currently have ${streamKeyCount} stream keys but ${tier.name} allows ${targetKeys}. Remove extra keys after switching.`
        : '';

    return {
      title: `Downgrade to ${tier.name}?`,
      description: `Your plan will change immediately. Stripe credits unused time on your next invoice.${keyWarning}${
        tier.has_watermark ? ' A watermark will be required on embeds.' : ''
      }`,
      confirmLabel: `Downgrade to ${tier.name}`,
      destructive: true,
    };
  }

  return {
    title: 'Change plan?',
    description: `Switch from ${planLabel || 'your current plan'} to ${tier.name}?`,
    confirmLabel: 'Confirm',
  };
}
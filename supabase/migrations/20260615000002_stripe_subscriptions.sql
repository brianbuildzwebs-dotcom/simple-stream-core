-- Stripe subscription identifiers for webhook activation

alter table public.user_subscriptions
  add column if not exists stripe_subscription_id text;

create index if not exists user_subscriptions_stripe_sub_idx
  on public.user_subscriptions (stripe_subscription_id);
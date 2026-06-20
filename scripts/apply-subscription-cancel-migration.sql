-- Run in Supabase SQL Editor
-- Tracks Stripe cancel-at-period-end so Profile can show "Access ends" instead of "Renews"

alter table public.user_subscriptions
  add column if not exists subscription_cancel_at timestamptz;

create index if not exists user_subscriptions_cancel_at_idx
  on public.user_subscriptions (subscription_cancel_at)
  where subscription_cancel_at is not null;
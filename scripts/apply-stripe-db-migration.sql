-- Run once in Supabase Dashboard → SQL Editor
-- Fixes: "Could not find the 'stripe_subscription_id' column"

alter table public.user_subscriptions
  add column if not exists stripe_subscription_id text;

create index if not exists user_subscriptions_stripe_sub_idx
  on public.user_subscriptions (stripe_subscription_id);

-- Reload PostgREST schema cache (Supabase usually picks this up within seconds)
notify pgrst, 'reload schema';
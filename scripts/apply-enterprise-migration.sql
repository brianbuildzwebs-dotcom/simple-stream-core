-- Run in Supabase SQL Editor (same as apply-stripe-db-migration.sql)

alter table public.user_subscriptions
  add column if not exists enterprise_offer_tier_id uuid references public.subscription_tiers (id) on delete set null,
  add column if not exists enterprise_offer_note text,
  add column if not exists enterprise_offer_at timestamptz,
  add column if not exists billing_managed_by text not null default 'stripe'
    check (billing_managed_by in ('stripe', 'manual'));

create index if not exists user_subscriptions_enterprise_offer_idx
  on public.user_subscriptions (enterprise_offer_tier_id)
  where enterprise_offer_tier_id is not null;

insert into public.subscription_tiers (
  name,
  description,
  monthly_price,
  max_bitrate_mbps,
  max_concurrent_viewers,
  storage_limit_gb,
  max_stream_keys,
  has_watermark,
  support_level,
  features,
  sort_order,
  is_active,
  cta_label,
  is_popular
)
select
  'Enterprise',
  'Custom limits and dedicated support for large organizations',
  0,
  15,
  5000,
  250,
  25,
  false,
  '24_7_chat',
  array['Custom stream key limits', 'Dedicated account support', 'Custom branding', 'Priority onboarding'],
  4,
  false,
  'Contact us for pricing',
  false
where not exists (
  select 1 from public.subscription_tiers where name = 'Enterprise'
);
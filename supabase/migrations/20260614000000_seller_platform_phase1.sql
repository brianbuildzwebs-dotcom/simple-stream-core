-- Phase 1: Simple Streamz seller platform tables
-- Subscription tiers, trials, stream keys, embeds (shell data for dashboard)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.subscription_tiers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  description            text,
  monthly_price          numeric(10, 2) not null,
  max_bitrate_mbps       numeric(6, 2),
  max_concurrent_viewers integer,
  storage_limit_gb       integer,
  max_stream_keys        integer default 1,
  has_watermark          boolean not null default true,
  support_level          text check (support_level in ('email', 'priority_email', '24_7_chat')),
  features               text[] not null default '{}',
  sort_order             integer not null default 0,
  is_active              boolean not null default true,
  cta_label              text not null default 'Start Free Trial',
  is_popular             boolean not null default false,
  stripe_price_id        text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.user_subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,
  subscription_tier_id      uuid references public.subscription_tiers (id) on delete set null,
  tier_name                 text,
  trial_active              boolean not null default true,
  trial_start_date          timestamptz,
  trial_end_date            timestamptz,
  is_paid                   boolean not null default false,
  payment_status            text not null default 'trial'
    check (payment_status in ('trial', 'unpaid_trial_expired', 'subscribed', 'free_admin', 'canceled')),
  payment_method            text not null default 'none'
    check (payment_method in ('stripe', 'paypal', 'manual_admin', 'none')),
  subscription_start_date   timestamptz,
  subscription_renewal_date timestamptz,
  last_payment_amount       numeric(10, 2),
  stripe_customer_id        text,
  trial_abuse_flagged       boolean not null default false,
  admin_notes               text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (user_id)
);

create table public.trial_abuse (
  id                  uuid primary key default gen_random_uuid(),
  ip_address_hash     text not null,
  email_list          text[] not null default '{}',
  registration_count  integer not null default 1,
  flagged_date        timestamptz not null default now(),
  admin_action        text not null default 'pending_review',
  is_resolved         boolean not null default false,
  created_at          timestamptz not null default now()
);

create unique index trial_abuse_ip_hash_idx on public.trial_abuse (ip_address_hash);

create table public.stream_keys (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  key_value        text not null,
  stream_name      text,
  rtmp_ingest_url  text,
  status           text not null default 'active'
    check (status in ('active', 'inactive', 'revoked')),
  is_live          boolean not null default false,
  viewer_count     integer not null default 0,
  total_view_hours numeric(12, 2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index stream_keys_user_id_idx on public.stream_keys (user_id);

create table public.embed_instances (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  tracking_code        text not null unique,
  name                 text,
  allowed_domains      text[] not null default '{}',
  video_source_type    text check (video_source_type in ('youtube', 'rtmp', 'upload')),
  video_source_url     text,
  stream_key_id        uuid references public.stream_keys (id) on delete set null,
  is_watermark_enabled boolean not null default true,
  watermark_text       text default '© Simple Streamz',
  watermark_position   text default 'bottom_right'
    check (watermark_position in ('top_left', 'top_right', 'bottom_left', 'bottom_right')),
  watermark_size       text default 'medium'
    check (watermark_size in ('small', 'medium', 'large')),
  watermark_opacity    numeric(3, 2) default 0.7,
  is_active            boolean not null default true,
  total_views          integer not null default 0,
  total_watch_minutes  numeric(12, 2) not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index embed_instances_user_id_idx on public.embed_instances (user_id);

create table public.domain_whitelist (
  id         uuid primary key default gen_random_uuid(),
  domain     text not null unique,
  is_active  boolean not null default true,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists ip_hash text;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger subscription_tiers_set_updated_at
  before update on public.subscription_tiers
  for each row execute function public.set_updated_at();

create trigger user_subscriptions_set_updated_at
  before update on public.user_subscriptions
  for each row execute function public.set_updated_at();

create trigger stream_keys_set_updated_at
  before update on public.stream_keys
  for each row execute function public.set_updated_at();

create trigger embed_instances_set_updated_at
  before update on public.embed_instances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Init trial subscription (10-day, no card)
-- ---------------------------------------------------------------------------

create or replace function public.init_user_subscription()
returns public.user_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.user_subscriptions%rowtype;
  trial_end timestamptz;
  new_sub public.user_subscriptions%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into existing
  from public.user_subscriptions
  where user_id = uid
  limit 1;

  if found then
    if existing.trial_active
      and existing.trial_end_date is not null
      and existing.trial_end_date < now()
      and existing.is_paid = false
      and existing.payment_status = 'trial'
    then
      update public.user_subscriptions
      set trial_active = false,
          payment_status = 'unpaid_trial_expired',
          updated_at = now()
      where id = existing.id
      returning * into existing;
    end if;
    return existing;
  end if;

  trial_end := now() + interval '10 days';

  insert into public.user_subscriptions (
    user_id,
    trial_active,
    trial_start_date,
    trial_end_date,
    is_paid,
    payment_status,
    payment_method
  ) values (
    uid,
    true,
    now(),
    trial_end,
    false,
    'trial',
    'none'
  )
  returning * into new_sub;

  return new_sub;
end;
$$;

revoke all on function public.init_user_subscription() from public;
grant execute on function public.init_user_subscription() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.subscription_tiers enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.trial_abuse enable row level security;
alter table public.stream_keys enable row level security;
alter table public.embed_instances enable row level security;
alter table public.domain_whitelist enable row level security;

-- subscription_tiers: public read active tiers, admin write
create policy "Active tiers are publicly readable"
  on public.subscription_tiers for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

create policy "Admins manage subscription tiers"
  on public.subscription_tiers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_subscriptions
create policy "Users read own subscription"
  on public.user_subscriptions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Users insert own subscription"
  on public.user_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users update own subscription"
  on public.user_subscriptions for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- stream_keys
create policy "Users manage own stream keys"
  on public.stream_keys for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- embed_instances
create policy "Users manage own embeds"
  on public.embed_instances for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- trial_abuse + domain_whitelist: admin only
create policy "Admins manage trial abuse"
  on public.trial_abuse for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins manage domain whitelist"
  on public.domain_whitelist for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed pricing tiers (Simple Streamz)
-- ---------------------------------------------------------------------------

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
) values
  (
    'Basic',
    'Perfect for getting started with live streaming',
    9.99,
    3,
    100,
    5,
    1,
    true,
    'email',
    array['HD streaming', 'Embeddable player', 'Live chat overlay'],
    1,
    true,
    'Start Free Trial',
    false
  ),
  (
    'Pro',
    'For growing creators and small teams',
    29.99,
    6,
    500,
    25,
    3,
    false,
    'priority_email',
    array['No watermark', 'Advanced analytics', 'Priority support'],
    2,
    true,
    'Start Free Trial',
    true
  ),
  (
    'Premium',
    'For churches, brands, and high-volume streaming',
    99.99,
    10,
    2000,
    100,
    10,
    false,
    '24_7_chat',
    array['Custom branding', 'Dedicated support', 'Highest limits'],
    3,
    true,
    'Start Free Trial',
    false
  );

-- Rebrand default player name
update public.player_settings
set player_name = 'Simple Streamz'
where player_name in ('Simple Streams', 'StreamDeck', 'Simple Stream Core');
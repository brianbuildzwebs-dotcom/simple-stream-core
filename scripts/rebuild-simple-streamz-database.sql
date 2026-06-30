-- REBUILD Simple Streamz database on project hxtlrwibkdyirnvejfor
-- Run in: https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new
-- Run this ENTIRE file once. Safe to re-run (uses IF NOT EXISTS / on conflict).
-- AFTER this: register at https://simplestreamz.io/register then run scripts/promote-admin.sql


-- ========== 20260610000000_initial_schema.sql ==========

-- Phase 1B: Initial Supabase schema for Simple Stream Core
-- Apply via Supabase Dashboard â†’ SQL Editor â†’ New query â†’ Run
-- Or with Supabase CLI: supabase db push

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer', 'admin')),
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_settings (
  id               uuid primary key default gen_random_uuid(),
  player_name      text not null default 'Simple Streams',
  logo_url         text,
  primary_color    text not null default '#3b82f6',
  chat_enabled     boolean not null default true,
  profanity_filter boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  user_name    text not null,
  user_color   text,
  content      text not null,
  is_deleted   boolean not null default false,
  is_simulated boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.banned_users (
  id         uuid primary key default gen_random_uuid(),
  user_name  text not null unique,
  reason     text,
  created_at timestamptz not null default now()
);

create index messages_created_at_idx on public.messages (created_at desc);
create index messages_active_idx on public.messages (created_at desc) where is_deleted = false;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger player_settings_set_updated_at
  before update on public.player_settings
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.player_settings enable row level security;
alter table public.messages enable row level security;
alter table public.banned_users enable row level security;

-- profiles
create policy "Profiles are viewable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- player_settings
create policy "Player settings are publicly readable"
  on public.player_settings for select
  to anon, authenticated
  using (true);

create policy "Admins can insert player settings"
  on public.player_settings for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update player settings"
  on public.player_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- messages (anonymous chat + admin moderation)
create policy "Active messages are publicly readable"
  on public.messages for select
  to anon, authenticated
  using (is_deleted = false);

create policy "Admins can read all messages"
  on public.messages for select
  to authenticated
  using (public.is_admin());

create policy "Anyone can post chat messages"
  on public.messages for insert
  to anon, authenticated
  with check (
    char_length(trim(user_name)) > 0
    and char_length(trim(content)) > 0
    and char_length(content) <= 500
  );

create policy "Admins can update messages"
  on public.messages for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete messages"
  on public.messages for delete
  to authenticated
  using (public.is_admin());

-- banned_users
create policy "Banned users are publicly readable"
  on public.banned_users for select
  to anon, authenticated
  using (true);

create policy "Admins can ban users"
  on public.banned_users for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can unban users"
  on public.banned_users for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime (chat overlay + admin panels)
-- ---------------------------------------------------------------------------

alter table public.messages replica identity full;
alter table public.banned_users replica identity full;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.banned_users;

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.player_settings (
  player_name,
  primary_color,
  chat_enabled,
  profanity_filter
) values (
  'Simple Streams',
  '#3b82f6',
  true,
  false
);

-- ---------------------------------------------------------------------------
-- Promote your first admin (run AFTER you register an account)
-- ---------------------------------------------------------------------------
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'you@example.com');

-- ========== 20260610000001_player_settings_realtime.sql ==========

-- Enable live settings updates on Home/Embed when admin saves changes

alter table public.player_settings replica identity full;
alter publication supabase_realtime add table public.player_settings;

-- ========== 20260610000002_complete_partial_setup.sql ==========

-- Run this if the initial migration failed partway (e.g. "messages already exists").
-- Safe to re-run: skips objects that already exist.

-- ---------------------------------------------------------------------------
-- Missing tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer', 'admin')),
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_settings (
  id               uuid primary key default gen_random_uuid(),
  player_name      text not null default 'Simple Streams',
  logo_url         text,
  primary_color    text not null default '#3b82f6',
  chat_enabled     boolean not null default true,
  profanity_filter boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table if not exists public.banned_users (
  id         uuid primary key default gen_random_uuid(),
  user_name  text not null unique,
  reason     text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  user_name    text not null,
  user_color   text,
  content      text not null,
  is_deleted   boolean not null default false,
  is_simulated boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_active_idx on public.messages (created_at desc) where is_deleted = false;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists player_settings_set_updated_at on public.player_settings;
create trigger player_settings_set_updated_at
  before update on public.player_settings
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.player_settings enable row level security;
alter table public.messages enable row level security;
alter table public.banned_users enable row level security;

drop policy if exists "Profiles are viewable by signed-in users" on public.profiles;
create policy "Profiles are viewable by signed-in users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Player settings are publicly readable" on public.player_settings;
create policy "Player settings are publicly readable"
  on public.player_settings for select to anon, authenticated using (true);

drop policy if exists "Admins can insert player settings" on public.player_settings;
create policy "Admins can insert player settings"
  on public.player_settings for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update player settings" on public.player_settings;
create policy "Admins can update player settings"
  on public.player_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Active messages are publicly readable" on public.messages;
create policy "Active messages are publicly readable"
  on public.messages for select to anon, authenticated using (is_deleted = false);

drop policy if exists "Admins can read all messages" on public.messages;
create policy "Admins can read all messages"
  on public.messages for select to authenticated using (public.is_admin());

drop policy if exists "Anyone can post chat messages" on public.messages;
create policy "Anyone can post chat messages"
  on public.messages for insert to anon, authenticated
  with check (
    char_length(trim(user_name)) > 0
    and char_length(trim(content)) > 0
    and char_length(content) <= 500
  );

drop policy if exists "Admins can update messages" on public.messages;
create policy "Admins can update messages"
  on public.messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete messages" on public.messages;
create policy "Admins can delete messages"
  on public.messages for delete to authenticated using (public.is_admin());

drop policy if exists "Banned users are publicly readable" on public.banned_users;
create policy "Banned users are publicly readable"
  on public.banned_users for select to anon, authenticated using (true);

drop policy if exists "Admins can ban users" on public.banned_users;
create policy "Admins can ban users"
  on public.banned_users for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can unban users" on public.banned_users;
create policy "Admins can unban users"
  on public.banned_users for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.messages replica identity full;
alter table public.banned_users replica identity full;
alter table public.player_settings replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.banned_users;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.player_settings;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.player_settings (
  player_name,
  primary_color,
  chat_enabled,
  profanity_filter
)
select 'Simple Streams', '#3b82f6', true, false
where not exists (select 1 from public.player_settings);

-- Backfill profiles for users who registered before this migration ran
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ========== 20260610000003_fix_messages_columns.sql ==========

-- Fix older messages table + finish setup (safe to re-run)

-- Add any columns the app expects but an older schema may be missing
alter table public.messages add column if not exists user_color text;
alter table public.messages add column if not exists is_deleted boolean not null default false;
alter table public.messages add column if not exists is_simulated boolean not null default false;
alter table public.messages add column if not exists created_at timestamptz not null default now();

create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_active_idx on public.messages (created_at desc) where is_deleted = false;

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer', 'admin')),
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_settings (
  id               uuid primary key default gen_random_uuid(),
  player_name      text not null default 'Simple Streams',
  logo_url         text,
  primary_color    text not null default '#3b82f6',
  chat_enabled     boolean not null default true,
  profanity_filter boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table if not exists public.banned_users (
  id         uuid primary key default gen_random_uuid(),
  user_name  text not null unique,
  reason     text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists player_settings_set_updated_at on public.player_settings;
create trigger player_settings_set_updated_at before update on public.player_settings
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.player_settings enable row level security;
alter table public.messages enable row level security;
alter table public.banned_users enable row level security;

drop policy if exists "Profiles are viewable by signed-in users" on public.profiles;
create policy "Profiles are viewable by signed-in users" on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Player settings are publicly readable" on public.player_settings;
create policy "Player settings are publicly readable" on public.player_settings for select to anon, authenticated using (true);

drop policy if exists "Admins can insert player settings" on public.player_settings;
create policy "Admins can insert player settings" on public.player_settings for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update player settings" on public.player_settings;
create policy "Admins can update player settings" on public.player_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Active messages are publicly readable" on public.messages;
create policy "Active messages are publicly readable" on public.messages for select to anon, authenticated using (is_deleted = false);

drop policy if exists "Admins can read all messages" on public.messages;
create policy "Admins can read all messages" on public.messages for select to authenticated using (public.is_admin());

drop policy if exists "Anyone can post chat messages" on public.messages;
create policy "Anyone can post chat messages" on public.messages for insert to anon, authenticated
  with check (char_length(trim(user_name)) > 0 and char_length(trim(content)) > 0 and char_length(content) <= 500);

drop policy if exists "Admins can update messages" on public.messages;
create policy "Admins can update messages" on public.messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete messages" on public.messages;
create policy "Admins can delete messages" on public.messages for delete to authenticated using (public.is_admin());

drop policy if exists "Banned users are publicly readable" on public.banned_users;
create policy "Banned users are publicly readable" on public.banned_users for select to anon, authenticated using (true);

drop policy if exists "Admins can ban users" on public.banned_users;
create policy "Admins can ban users" on public.banned_users for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can unban users" on public.banned_users;
create policy "Admins can unban users" on public.banned_users for delete to authenticated using (public.is_admin());

alter table public.messages replica identity full;
alter table public.banned_users replica identity full;
alter table public.player_settings replica identity full;

do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.banned_users; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.player_settings; exception when duplicate_object then null; end $$;

insert into public.player_settings (player_name, primary_color, chat_enabled, profanity_filter)
select 'Simple Streams', '#3b82f6', true, false
where not exists (select 1 from public.player_settings);

insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ========== 20260610000004_align_messages_schema.sql ==========

-- Align legacy messages columns (user/text) with app schema (user_name/content).
-- Run in Supabase â†’ SQL Editor if chat sends fail with NOT NULL errors on "user" or "text".

alter table public.messages add column if not exists user_name text;
alter table public.messages add column if not exists user_color text;
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists is_deleted boolean not null default false;
alter table public.messages add column if not exists is_simulated boolean not null default false;
alter table public.messages add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'user'
  ) then
    execute $sql$
      update public.messages
      set user_name = coalesce(user_name, "user")
      where user_name is null and "user" is not null
    $sql$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'text'
  ) then
    execute $sql$
      update public.messages
      set content = coalesce(content, text)
      where content is null and text is not null
    $sql$;
  end if;
end $$;

update public.messages
set user_name = 'User'
where user_name is null or char_length(trim(user_name)) = 0;

delete from public.messages
where content is null or char_length(trim(content)) = 0;

alter table public.messages alter column user_name set not null;
alter table public.messages alter column content set not null;

alter table public.messages drop column if exists "user";
alter table public.messages drop column if exists text;

-- ========== 20260610000005_messages_source_key.sql ==========

-- Scope chat messages per video/stream (source_key changes when the user loads a new URL).

alter table public.messages add column if not exists source_key text;

create index if not exists messages_source_key_created_at_idx
  on public.messages (source_key, created_at desc)
  where is_deleted = false;

-- ========== 20260614000000_seller_platform_phase1.sql ==========

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
  watermark_text       text default 'Â© Simple Streamz',
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

-- ========== 20260615000000_phase2_stream_keys.sql ==========

-- Phase 2: Cloudflare Stream fields for stream keys

alter table public.stream_keys
  add column if not exists cloudflare_input_id text,
  add column if not exists hls_playback_url text;

create index if not exists stream_keys_cf_input_idx on public.stream_keys (cloudflare_input_id);

-- ========== 20260615000001_embed_grants.sql ==========

-- Ensure authenticated users can manage seller dashboard tables from the client

grant select, insert, update, delete on public.stream_keys to authenticated;
grant select, insert, update, delete on public.embed_instances to authenticated;
grant select, insert, update on public.user_subscriptions to authenticated;
grant select on public.subscription_tiers to authenticated, anon;

-- ========== 20260615000002_stripe_subscriptions.sql ==========

-- Stripe subscription identifiers for webhook activation

alter table public.user_subscriptions
  add column if not exists stripe_subscription_id text;

create index if not exists user_subscriptions_stripe_sub_idx
  on public.user_subscriptions (stripe_subscription_id);

-- ========== 20260618000001_enterprise_offers.sql ==========

-- Enterprise upgrade offers + manual billing (Stripe-safe)

alter table public.user_subscriptions
  add column if not exists enterprise_offer_tier_id uuid references public.subscription_tiers (id) on delete set null,
  add column if not exists enterprise_offer_note text,
  add column if not exists enterprise_offer_at timestamptz,
  add column if not exists billing_managed_by text not null default 'stripe'
    check (billing_managed_by in ('stripe', 'manual')),
  add column if not exists enterprise_requested_at timestamptz,
  add column if not exists enterprise_request_note text;

create index if not exists user_subscriptions_enterprise_offer_idx
  on public.user_subscriptions (enterprise_offer_tier_id)
  where enterprise_offer_tier_id is not null;

create index if not exists user_subscriptions_enterprise_request_idx
  on public.user_subscriptions (enterprise_requested_at desc)
  where enterprise_requested_at is not null;

-- Default Enterprise tier (inactive on public pricing; assign via admin offer)
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

-- ========== 20260619000001_chat_owner_moderation.sql ==========

-- Per-account chat moderation: scope messages and bans to embed owners.

alter table public.messages
  add column if not exists owner_user_id uuid references auth.users (id) on delete cascade,
  add column if not exists embed_id uuid references public.embed_instances (id) on delete set null;

create index if not exists messages_owner_user_id_idx
  on public.messages (owner_user_id, created_at desc);

create index if not exists messages_owner_source_key_idx
  on public.messages (owner_user_id, source_key, created_at desc)
  where is_deleted = false;

alter table public.banned_users
  add column if not exists owner_user_id uuid references auth.users (id) on delete cascade,
  add column if not exists source_key text;

create index if not exists banned_users_owner_source_idx
  on public.banned_users (owner_user_id, source_key);

alter table public.embed_instances
  add column if not exists chat_enabled boolean not null default true;

-- Embed owners can read all of their messages (including deleted) for moderation.
create policy "Embed owners can read their messages"
  on public.messages for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "Embed owners can update their messages"
  on public.messages for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "Embed owners can ban on their players"
  on public.banned_users for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "Embed owners can unban on their players"
  on public.banned_users for delete
  to authenticated
  using (owner_user_id = auth.uid());

-- ========== 20260620000001_terms_acceptance.sql ==========

-- Track legal acceptance on user profiles (signup / free trial gate).

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_version text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    terms_accepted_at,
    terms_version,
    privacy_accepted_at,
    privacy_version
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz,
    new.raw_user_meta_data ->> 'terms_version',
    nullif(new.raw_user_meta_data ->> 'privacy_accepted_at', '')::timestamptz,
    new.raw_user_meta_data ->> 'privacy_version'
  );
  return new;
end;
$$;

-- ========== 20260620000002_legal_acceptance_audit.sql ==========

-- Append-only legal acceptance audit log.
-- Survives account deletion (user_id cleared, account_deleted_at set).

create table if not exists public.legal_acceptance_events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users (id) on delete set null,
  email_hash          text not null,
  terms_version       text not null,
  privacy_version     text not null,
  accepted_at         timestamptz not null default now(),
  acceptance_method   text not null
    check (acceptance_method in ('email', 'google', 'oauth', 'reaccept')),
  ip_address_hash     text,
  user_agent          text,
  account_deleted_at  timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists legal_acceptance_events_user_id_idx
  on public.legal_acceptance_events (user_id)
  where user_id is not null;

create index if not exists legal_acceptance_events_email_hash_idx
  on public.legal_acceptance_events (email_hash);

create index if not exists legal_acceptance_events_accepted_at_idx
  on public.legal_acceptance_events (accepted_at desc);

create unique index if not exists legal_acceptance_events_active_user_version_idx
  on public.legal_acceptance_events (user_id, terms_version, privacy_version)
  where user_id is not null and account_deleted_at is null;

alter table public.legal_acceptance_events enable row level security;

create policy "Admins read legal acceptance events"
  on public.legal_acceptance_events for select
  to authenticated
  using (public.is_admin());

-- ========== 20260620000003_embed_offline_playback.sql ==========

-- Offline holding copy and optional replay for RTMP embeds
alter table public.embed_instances
  add column if not exists holding_title text,
  add column if not exists holding_message text,
  add column if not exists replay_when_offline boolean not null default true;

-- ========== 20260620000004_disable_offline_replay_default.sql ==========

-- Launch default: holding screen + live only; replay/library is Phase B
alter table public.embed_instances
  alter column replay_when_offline set default false;

update public.embed_instances
set replay_when_offline = false
where replay_when_offline = true;

-- ========== 20260620000005_give_support_suggestions.sql ==========

-- Per-embed online giving link + user support tickets + feature suggestions.

alter table public.embed_instances
  add column if not exists give_enabled boolean not null default false,
  add column if not exists give_url text,
  add column if not exists give_label text not null default 'Give';

create table if not exists public.support_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  user_email       text,
  category         text not null default 'other'
    check (category in ('streaming', 'embed', 'chat', 'billing', 'account', 'other')),
  severity         text not null default 'question'
    check (severity in ('blocking', 'annoying', 'question')),
  subject          text not null,
  description      text not null,
  steps_tried      text,
  browser_device   text,
  page_url         text,
  status           text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists support_requests_user_id_idx
  on public.support_requests (user_id, created_at desc);

create index if not exists support_requests_status_idx
  on public.support_requests (status, created_at desc);

create table if not exists public.feature_suggestions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  user_email       text,
  title            text not null,
  description      text not null,
  use_case         text,
  priority         text not null default 'nice_to_have'
    check (priority in ('must_have', 'nice_to_have', 'someday')),
  status           text not null default 'new'
    check (status in ('new', 'reviewing', 'planned', 'shipped', 'declined')),
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists feature_suggestions_user_id_idx
  on public.feature_suggestions (user_id, created_at desc);

create index if not exists feature_suggestions_status_idx
  on public.feature_suggestions (status, created_at desc);

drop trigger if exists support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

drop trigger if exists feature_suggestions_set_updated_at on public.feature_suggestions;
create trigger feature_suggestions_set_updated_at
  before update on public.feature_suggestions
  for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;
alter table public.feature_suggestions enable row level security;

create policy "Users can insert their support requests"
  on public.support_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can read their support requests"
  on public.support_requests for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins can update support requests"
  on public.support_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can insert feature suggestions"
  on public.feature_suggestions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can read feature suggestions"
  on public.feature_suggestions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins can update feature suggestions"
  on public.feature_suggestions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ========== 20260621000002_stream_alerts.sql ==========

-- Stream disconnect alerts (in-app audit log + cooldown timestamps on keys)

alter table public.stream_keys
  add column if not exists last_connected_at timestamptz,
  add column if not exists last_disconnect_alert_at timestamptz;

create table if not exists public.stream_alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  stream_key_id   uuid references public.stream_keys (id) on delete set null,
  stream_name     text,
  message         text not null,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  email_sent_at   timestamptz
);

create index if not exists stream_alerts_user_unread_idx
  on public.stream_alerts (user_id, created_at desc)
  where read_at is null;

create index if not exists stream_keys_monitor_idx
  on public.stream_keys (is_live, last_connected_at desc)
  where status = 'active';

alter table public.stream_alerts enable row level security;

create policy "Users read own stream alerts"
  on public.stream_alerts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users update own stream alerts"
  on public.stream_alerts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ========== 20260621000003_sermon_recordings.sql ==========

-- Sermon library: synced Cloudflare live recordings per stream key

create table if not exists public.sermon_recordings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  stream_key_id         uuid not null references public.stream_keys (id) on delete cascade,
  cloudflare_video_uid  text not null,
  stream_name           text,
  title                 text not null,
  recorded_at           timestamptz not null,
  duration_seconds      integer,
  hls_playback_url      text,
  mp4_download_url      text,
  mp4_status            text check (mp4_status in ('inprogress', 'ready')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists sermon_recordings_video_uid_idx
  on public.sermon_recordings (cloudflare_video_uid);

create index if not exists sermon_recordings_user_recorded_idx
  on public.sermon_recordings (user_id, recorded_at desc);

create index if not exists sermon_recordings_stream_key_idx
  on public.sermon_recordings (stream_key_id, recorded_at desc);

create trigger sermon_recordings_set_updated_at
  before update on public.sermon_recordings
  for each row execute function public.set_updated_at();

alter table public.sermon_recordings enable row level security;

create policy "Users read own sermon recordings"
  on public.sermon_recordings for select
  to authenticated
  using (auth.uid() = user_id);

-- ========== 20260622000001_service_schedule.sql ==========

-- Church-wide weekly service schedule for embed holding screens

alter table public.profiles
  add column if not exists service_timezone text not null default 'America/New_York';

create table if not exists public.service_schedule_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  time_local   time not null,
  label        text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists service_schedule_slots_user_idx
  on public.service_schedule_slots (user_id, sort_order, day_of_week, time_local);

alter table public.service_schedule_slots enable row level security;

create policy "Users read own service schedule"
  on public.service_schedule_slots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own service schedule"
  on public.service_schedule_slots for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own service schedule"
  on public.service_schedule_slots for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own service schedule"
  on public.service_schedule_slots for delete
  to authenticated
  using (auth.uid() = user_id);

-- ========== 20260623000001_platform_settings.sql ==========

-- Admin-controlled launch marketing and feature flags (service role / worker API only).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on public.platform_settings to postgres, service_role;

insert into public.platform_settings (key, value) values
  (
    'launch_offer',
    '{
      "active": true,
      "headline": "Launch pricing â€” limited time",
      "offerEndsAt": "2026-09-30",
      "offerEndsLabel": "Through September 30, 2026",
      "futurePrices": { "Basic": 14.99, "Pro": 39.99, "Premium": 129.99 }
    }'::jsonb
  ),
  (
    'simulcast',
    '{"status": "coming_soon"}'::jsonb
  )
on conflict (key) do nothing;

notify pgrst, 'reload schema';

-- ========== 20260624000001_security_hardening.sql ==========

-- Security hardening: block self-service billing/role escalation from the client.

-- 1) Profiles: prevent non-admins from changing role
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if new.role is distinct from old.role then
    if session_user in ('postgres', 'supabase_admin') then
      return new;
    end if;

    if jwt_role = 'service_role' then
      return new;
    end if;

    if public.is_admin() then
      return new;
    end if;

    raise exception 'Only administrators can change profile roles';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;

create trigger prevent_profile_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_role_escalation();

-- 2) Subscriptions: block client writes to billing fields (worker/webhooks use service_role)
create or replace function public.prevent_subscription_billing_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if jwt_role = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  raise exception 'Subscription billing changes must go through Stripe or an administrator';
end;
$$;

drop trigger if exists prevent_subscription_billing_escalation on public.user_subscriptions;

create trigger prevent_subscription_billing_escalation
  before insert or update on public.user_subscriptions
  for each row
  execute function public.prevent_subscription_billing_escalation();

drop policy if exists "Users insert own subscription" on public.user_subscriptions;
drop policy if exists "Users update own subscription" on public.user_subscriptions;

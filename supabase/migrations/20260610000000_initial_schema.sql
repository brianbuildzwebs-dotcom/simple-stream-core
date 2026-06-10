-- Phase 1B: Initial Supabase schema for Simple Stream Core
-- Apply via Supabase Dashboard → SQL Editor → New query → Run
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
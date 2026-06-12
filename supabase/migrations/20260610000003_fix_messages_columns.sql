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
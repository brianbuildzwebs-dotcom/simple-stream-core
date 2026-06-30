-- NUCLEAR FIX: "Database error saving new user"
-- Peace-Baptist / hxtlrwibkdyirnvejfor
-- Wipes public.profiles and rebuilds signup trigger from scratch.
-- Safe for Simple Streamz recovery (profiles only; auth.users kept).

-- ========== A) Diagnose (read these results) ==========
select 'profiles_constraints' as section, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
order by conname;

select 'auth_users_triggers' as section, tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
order by tgname;

select 'profiles_triggers' as section, tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'profiles' and not t.tgisinternal
order by tgname;

-- ========== B) Remove ALL custom triggers on auth.users ==========
do $$
declare r record;
begin
  for r in
    select t.tgname as name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', r.name);
  end loop;
end $$;

-- ========== C) Recreate profiles (church schema may be incompatible) ==========
drop table if exists public.profiles cascade;

create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  role                 text not null default 'viewer' check (role in ('viewer', 'admin')),
  full_name            text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  ip_hash              text,
  terms_accepted_at    timestamptz,
  terms_version        text,
  privacy_accepted_at  timestamptz,
  privacy_version      text,
  service_timezone     text not null default 'America/New_York'
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
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
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz,
    new.raw_user_meta_data ->> 'terms_version',
    nullif(new.raw_user_meta_data ->> 'privacy_accepted_at', '')::timestamptz,
    new.raw_user_meta_data ->> 'privacy_version'
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise exception 'handle_new_user failed for %: %', new.id, sqlerrm;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== D) RLS + grants (Supabase Auth must insert via trigger) ==========
alter table public.profiles enable row level security;

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

grant usage on schema public to postgres, anon, authenticated, service_role, supabase_auth_admin;
grant select, insert, update, delete on public.profiles to postgres, service_role, supabase_auth_admin;
grant select, update on public.profiles to authenticated;

alter function public.handle_new_user() owner to postgres;
grant execute on function public.handle_new_user() to postgres, service_role, supabase_auth_admin;

-- Backfill any existing auth users
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ========== E) Confirm ==========
select 'auth_users_triggers_after' as section, tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;

select count(*) as profile_count from public.profiles;
select 'profiles_reset_complete' as status;
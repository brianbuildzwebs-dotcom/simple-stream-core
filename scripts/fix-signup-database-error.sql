-- Fix "Database error saving new user" on /register
-- Run in Supabase SQL Editor: Peace-Baptist project

-- 1) Diagnose (review output)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;

select tgname, tgrelid::regclass as on_table, tgenabled
from pg_trigger
where tgname = 'on_auth_user_created';

select proname, prosecdef as security_definer
from pg_proc
where proname = 'handle_new_user' and pronamespace = 'public'::regnamespace;

-- 2) Ensure profiles has Simple Streamz columns (safe if already present)
alter table public.profiles
  add column if not exists role text not null default 'viewer',
  add column if not exists full_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists ip_hash text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists privacy_version text,
  add column if not exists service_timezone text not null default 'America/New_York';

-- 3) Robust signup trigger (ON CONFLICT + safe timestamp parsing)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  terms_at timestamptz;
  privacy_at timestamptz;
begin
  begin
    terms_at := nullif(new.raw_user_meta_data ->> 'terms_accepted_at', '')::timestamptz;
  exception when others then
    terms_at := null;
  end;

  begin
    privacy_at := nullif(new.raw_user_meta_data ->> 'privacy_accepted_at', '')::timestamptz;
  exception when others then
    privacy_at := null;
  end;

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
    terms_at,
    new.raw_user_meta_data ->> 'terms_version',
    privacy_at,
    new.raw_user_meta_data ->> 'privacy_version'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    terms_accepted_at = coalesce(excluded.terms_accepted_at, public.profiles.terms_accepted_at),
    terms_version = coalesce(excluded.terms_version, public.profiles.terms_version),
    privacy_accepted_at = coalesce(excluded.privacy_accepted_at, public.profiles.privacy_accepted_at),
    privacy_version = coalesce(excluded.privacy_version, public.profiles.privacy_version),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant usage on schema public to postgres, anon, authenticated, service_role;
grant select, insert, update on public.profiles to postgres, service_role;

-- 4) Confirm trigger is wired
select 'handle_new_user ready' as status,
       exists (
         select 1 from pg_trigger
         where tgname = 'on_auth_user_created'
       ) as trigger_exists;
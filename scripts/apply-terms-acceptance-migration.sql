-- Run in Supabase SQL Editor if migrations are applied manually.

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
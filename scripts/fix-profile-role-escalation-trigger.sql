-- Fix: allow Supabase SQL Editor (postgres) and service role to manage roles,
-- while still blocking normal users from self-promoting to admin.

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
    -- Dashboard SQL Editor / migrations (postgres)
    if session_user in ('postgres', 'supabase_admin') then
      return new;
    end if;

    -- Worker / server-side service role
    if jwt_role = 'service_role' then
      return new;
    end if;

    -- Existing admin changing another profile
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
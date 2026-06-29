-- Paste into Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- Blocks client-side subscription billing tampering and profile role escalation.

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
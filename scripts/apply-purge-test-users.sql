-- Purge test accounts — keep every user with profiles.role = 'admin'.
-- Run in Supabase Dashboard → SQL Editor → New query.
-- Project: https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new
--
-- Step 1: Run ONLY the PREVIEW block first. Confirm the delete list looks right.
-- Step 2: Run the PURGE block in a second query (or uncomment and run all).

-- =============================================================================
-- PREVIEW — accounts that will be KEPT (admins only)
-- =============================================================================
select
  u.id,
  u.email,
  u.created_at,
  p.role,
  p.full_name
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'admin'
order by u.created_at;

-- =============================================================================
-- PREVIEW — accounts that will be DELETED
-- =============================================================================
select
  u.id,
  u.email,
  u.created_at,
  coalesce(p.role, '(no profile)') as role,
  coalesce(p.full_name, '') as full_name
from auth.users u
left join public.profiles p on p.id = u.id
where not exists (
  select 1
  from public.profiles admin_p
  where admin_p.id = u.id
    and admin_p.role = 'admin'
)
order by u.created_at;

-- =============================================================================
-- PURGE — run only after preview looks correct
-- =============================================================================
begin;

-- Preserve legal audit rows (same as in-app account deletion)
update public.legal_acceptance_events la
set
  user_id = null,
  account_deleted_at = coalesce(la.account_deleted_at, now())
where la.user_id in (
  select u.id
  from auth.users u
  where not exists (
    select 1
    from public.profiles p
    where p.id = u.id
      and p.role = 'admin'
  )
);

-- Cascades to profiles, subscriptions, stream keys, embeds, sermons, alerts, etc.
delete from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
    and p.role = 'admin'
);

commit;

-- =============================================================================
-- VERIFY — should list admin account(s) only
-- =============================================================================
select u.id, u.email, p.role, p.full_name
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
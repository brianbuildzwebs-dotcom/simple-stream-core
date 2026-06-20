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
-- Run in Supabase SQL Editor if migrations are applied manually.

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

drop policy if exists "Users read own stream alerts" on public.stream_alerts;
drop policy if exists "Users update own stream alerts" on public.stream_alerts;

create policy "Users read own stream alerts"
  on public.stream_alerts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users update own stream alerts"
  on public.stream_alerts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
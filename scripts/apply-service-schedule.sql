-- Run in Supabase SQL Editor if service schedule migration was not pushed yet.
-- See supabase/migrations/20260622000001_service_schedule.sql

alter table public.profiles
  add column if not exists service_timezone text not null default 'America/New_York';

create table if not exists public.service_schedule_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  time_local   time not null,
  label        text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists service_schedule_slots_user_idx
  on public.service_schedule_slots (user_id, sort_order, day_of_week, time_local);

alter table public.service_schedule_slots enable row level security;

drop policy if exists "Users read own service schedule" on public.service_schedule_slots;
create policy "Users read own service schedule"
  on public.service_schedule_slots for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own service schedule" on public.service_schedule_slots;
create policy "Users insert own service schedule"
  on public.service_schedule_slots for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own service schedule" on public.service_schedule_slots;
create policy "Users update own service schedule"
  on public.service_schedule_slots for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own service schedule" on public.service_schedule_slots;
create policy "Users delete own service schedule"
  on public.service_schedule_slots for delete
  to authenticated
  using (auth.uid() = user_id);
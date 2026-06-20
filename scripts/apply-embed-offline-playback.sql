-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
alter table public.embed_instances
  add column if not exists holding_title text,
  add column if not exists holding_message text,
  add column if not exists replay_when_offline boolean not null default true;
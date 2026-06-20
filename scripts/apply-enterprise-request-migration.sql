-- Run in Supabase SQL Editor after apply-enterprise-migration.sql

alter table public.user_subscriptions
  add column if not exists enterprise_requested_at timestamptz,
  add column if not exists enterprise_request_note text;

create index if not exists user_subscriptions_enterprise_request_idx
  on public.user_subscriptions (enterprise_requested_at desc)
  where enterprise_requested_at is not null;
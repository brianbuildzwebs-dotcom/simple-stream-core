-- Run in Supabase SQL Editor: Dashboard → SQL → New query → paste → Run

alter table public.embed_instances
  add column if not exists give_enabled boolean not null default false,
  add column if not exists give_url text,
  add column if not exists give_label text not null default 'Give';

create table if not exists public.support_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  user_email       text,
  category         text not null default 'other'
    check (category in ('streaming', 'embed', 'chat', 'billing', 'account', 'other')),
  severity         text not null default 'question'
    check (severity in ('blocking', 'annoying', 'question')),
  subject          text not null,
  description      text not null,
  steps_tried      text,
  browser_device   text,
  page_url         text,
  status           text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists support_requests_user_id_idx
  on public.support_requests (user_id, created_at desc);

create index if not exists support_requests_status_idx
  on public.support_requests (status, created_at desc);

create table if not exists public.feature_suggestions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  user_email       text,
  title            text not null,
  description      text not null,
  use_case         text,
  priority         text not null default 'nice_to_have'
    check (priority in ('must_have', 'nice_to_have', 'someday')),
  status           text not null default 'new'
    check (status in ('new', 'reviewing', 'planned', 'shipped', 'declined')),
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists feature_suggestions_user_id_idx
  on public.feature_suggestions (user_id, created_at desc);

create index if not exists feature_suggestions_status_idx
  on public.feature_suggestions (status, created_at desc);

drop trigger if exists support_requests_set_updated_at on public.support_requests;
create trigger support_requests_set_updated_at
  before update on public.support_requests
  for each row execute function public.set_updated_at();

drop trigger if exists feature_suggestions_set_updated_at on public.feature_suggestions;
create trigger feature_suggestions_set_updated_at
  before update on public.feature_suggestions
  for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;
alter table public.feature_suggestions enable row level security;

drop policy if exists "Users can insert their support requests" on public.support_requests;
create policy "Users can insert their support requests"
  on public.support_requests for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can read their support requests" on public.support_requests;
create policy "Users can read their support requests"
  on public.support_requests for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update support requests" on public.support_requests;
create policy "Admins can update support requests"
  on public.support_requests for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can insert feature suggestions" on public.feature_suggestions;
create policy "Users can insert feature suggestions"
  on public.feature_suggestions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can read feature suggestions" on public.feature_suggestions;
create policy "Users can read feature suggestions"
  on public.feature_suggestions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update feature suggestions" on public.feature_suggestions;
create policy "Admins can update feature suggestions"
  on public.feature_suggestions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
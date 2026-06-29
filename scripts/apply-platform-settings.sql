-- Run in Supabase SQL Editor if platform_settings migration was not applied yet.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on public.platform_settings to postgres, service_role;

insert into public.platform_settings (key, value) values
  (
    'launch_offer',
    '{
      "active": true,
      "headline": "Launch pricing — limited time",
      "offerEndsAt": "2026-09-30",
      "offerEndsLabel": "Through September 30, 2026",
      "futurePrices": { "Basic": 14.99, "Pro": 39.99, "Premium": 129.99 }
    }'::jsonb
  ),
  (
    'simulcast',
    '{"status": "coming_soon"}'::jsonb
  )
on conflict (key) do nothing;

notify pgrst, 'reload schema';
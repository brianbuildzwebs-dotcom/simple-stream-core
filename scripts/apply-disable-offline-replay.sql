-- Run in Supabase SQL Editor to disable auto-replay on all embeds (launch default)
alter table public.embed_instances
  alter column replay_when_offline set default false;

update public.embed_instances
set replay_when_offline = false
where replay_when_offline = true;
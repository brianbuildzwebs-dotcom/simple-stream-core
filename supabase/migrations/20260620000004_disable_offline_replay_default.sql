-- Launch default: holding screen + live only; replay/library is Phase B
alter table public.embed_instances
  alter column replay_when_offline set default false;

update public.embed_instances
set replay_when_offline = false
where replay_when_offline = true;
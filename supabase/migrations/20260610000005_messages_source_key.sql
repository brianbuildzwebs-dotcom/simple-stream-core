-- Scope chat messages per video/stream (source_key changes when the user loads a new URL).

alter table public.messages add column if not exists source_key text;

create index if not exists messages_source_key_created_at_idx
  on public.messages (source_key, created_at desc)
  where is_deleted = false;
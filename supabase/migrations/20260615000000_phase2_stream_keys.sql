-- Phase 2: Cloudflare Stream fields for stream keys

alter table public.stream_keys
  add column if not exists cloudflare_input_id text,
  add column if not exists hls_playback_url text;

create index if not exists stream_keys_cf_input_idx on public.stream_keys (cloudflare_input_id);
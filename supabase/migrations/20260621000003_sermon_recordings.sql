-- Sermon library: synced Cloudflare live recordings per stream key

create table if not exists public.sermon_recordings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  stream_key_id         uuid not null references public.stream_keys (id) on delete cascade,
  cloudflare_video_uid  text not null,
  stream_name           text,
  title                 text not null,
  recorded_at           timestamptz not null,
  duration_seconds      integer,
  hls_playback_url      text,
  mp4_download_url      text,
  mp4_status            text check (mp4_status in ('inprogress', 'ready')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists sermon_recordings_video_uid_idx
  on public.sermon_recordings (cloudflare_video_uid);

create index if not exists sermon_recordings_user_recorded_idx
  on public.sermon_recordings (user_id, recorded_at desc);

create index if not exists sermon_recordings_stream_key_idx
  on public.sermon_recordings (stream_key_id, recorded_at desc);

create trigger sermon_recordings_set_updated_at
  before update on public.sermon_recordings
  for each row execute function public.set_updated_at();

alter table public.sermon_recordings enable row level security;

create policy "Users read own sermon recordings"
  on public.sermon_recordings for select
  to authenticated
  using (auth.uid() = user_id);
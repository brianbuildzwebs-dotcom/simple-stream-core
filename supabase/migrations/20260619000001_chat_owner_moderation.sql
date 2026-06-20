-- Per-account chat moderation: scope messages and bans to embed owners.

alter table public.messages
  add column if not exists owner_user_id uuid references auth.users (id) on delete cascade,
  add column if not exists embed_id uuid references public.embed_instances (id) on delete set null;

create index if not exists messages_owner_user_id_idx
  on public.messages (owner_user_id, created_at desc);

create index if not exists messages_owner_source_key_idx
  on public.messages (owner_user_id, source_key, created_at desc)
  where is_deleted = false;

alter table public.banned_users
  add column if not exists owner_user_id uuid references auth.users (id) on delete cascade,
  add column if not exists source_key text;

create index if not exists banned_users_owner_source_idx
  on public.banned_users (owner_user_id, source_key);

alter table public.embed_instances
  add column if not exists chat_enabled boolean not null default true;

-- Embed owners can read all of their messages (including deleted) for moderation.
create policy "Embed owners can read their messages"
  on public.messages for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "Embed owners can update their messages"
  on public.messages for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "Embed owners can ban on their players"
  on public.banned_users for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "Embed owners can unban on their players"
  on public.banned_users for delete
  to authenticated
  using (owner_user_id = auth.uid());
-- Align legacy messages columns (user/text) with app schema (user_name/content).
-- Run in Supabase → SQL Editor if chat sends fail with NOT NULL errors on "user" or "text".

alter table public.messages add column if not exists user_name text;
alter table public.messages add column if not exists user_color text;
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists is_deleted boolean not null default false;
alter table public.messages add column if not exists is_simulated boolean not null default false;
alter table public.messages add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'user'
  ) then
    execute $sql$
      update public.messages
      set user_name = coalesce(user_name, "user")
      where user_name is null and "user" is not null
    $sql$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'text'
  ) then
    execute $sql$
      update public.messages
      set content = coalesce(content, text)
      where content is null and text is not null
    $sql$;
  end if;
end $$;

update public.messages
set user_name = 'User'
where user_name is null or char_length(trim(user_name)) = 0;

delete from public.messages
where content is null or char_length(trim(content)) = 0;

alter table public.messages alter column user_name set not null;
alter table public.messages alter column content set not null;

alter table public.messages drop column if exists "user";
alter table public.messages drop column if exists text;
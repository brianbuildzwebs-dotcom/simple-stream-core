-- Enable live settings updates on Home/Embed when admin saves changes

alter table public.player_settings replica identity full;
alter publication supabase_realtime add table public.player_settings;
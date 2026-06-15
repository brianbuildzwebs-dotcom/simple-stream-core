-- Ensure authenticated users can manage seller dashboard tables from the client

grant select, insert, update, delete on public.stream_keys to authenticated;
grant select, insert, update, delete on public.embed_instances to authenticated;
grant select, insert, update on public.user_subscriptions to authenticated;
grant select on public.subscription_tiers to authenticated, anon;
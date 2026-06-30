-- Run after rebuild-simple-streamz-database.sql to confirm schema is back.

select 'profiles' as object_name, to_regclass('public.profiles') is not null as exists
union all select 'user_subscriptions', to_regclass('public.user_subscriptions') is not null
union all select 'stream_keys', to_regclass('public.stream_keys') is not null
union all select 'platform_settings', to_regclass('public.platform_settings') is not null
union all select 'legal_acceptance_events', to_regclass('public.legal_acceptance_events') is not null
union all select 'subscription_tiers', to_regclass('public.subscription_tiers') is not null
order by object_name;

select count(*) as user_count from auth.users;
select count(*) as profile_count from public.profiles;
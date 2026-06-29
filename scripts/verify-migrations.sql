-- Run in Supabase SQL Editor to confirm production schema is up to date.
-- Each row should show exists = true.

select 'platform_settings' as object_name,
       to_regclass('public.platform_settings') is not null as exists
union all
select 'stream_alerts', to_regclass('public.stream_alerts') is not null
union all
select 'sermon_recordings', to_regclass('public.sermon_recordings') is not null
union all
select 'service_schedule', to_regclass('public.service_schedule') is not null
union all
select 'trial_abuse', to_regclass('public.trial_abuse') is not null
union all
select 'prevent_profile_role_escalation', to_regprocedure('public.prevent_profile_role_escalation()') is not null
union all
select 'prevent_subscription_billing_escalation', to_regprocedure('public.prevent_subscription_billing_escalation()') is not null
order by object_name;
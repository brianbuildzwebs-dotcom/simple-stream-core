-- Activate FaithStart / Basic for peacebaptist320@gmail.com after live Stripe checkout.
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new
--
-- Optional: replace the two NULLs below with Stripe ids from Dashboard → Subscriptions.

-- PREVIEW
select
  u.id as user_id,
  u.email,
  p.full_name,
  s.is_paid,
  s.payment_status,
  s.tier_name,
  s.stripe_subscription_id
from auth.users u
left join public.profiles p on p.id = u.id
left join public.user_subscriptions s on s.user_id = u.id
where lower(u.email) = lower('peacebaptist320@gmail.com');

begin;

insert into public.user_subscriptions (
  user_id,
  subscription_tier_id,
  tier_name,
  trial_active,
  is_paid,
  payment_status,
  payment_method,
  billing_managed_by,
  subscription_start_date,
  last_payment_amount,
  stripe_customer_id,
  stripe_subscription_id
)
select
  u.id,
  t.id,
  t.name,
  false,
  true,
  'subscribed',
  'stripe',
  'stripe',
  now(),
  t.monthly_price,
  null::text,  -- optional: cus_...
  null::text   -- optional: sub_...
from auth.users u
cross join public.subscription_tiers t
where lower(u.email) = lower('peacebaptist320@gmail.com')
  and t.name = 'Basic'
on conflict (user_id) do update
set
  subscription_tier_id = excluded.subscription_tier_id,
  tier_name = excluded.tier_name,
  trial_active = false,
  is_paid = true,
  payment_status = 'subscribed',
  payment_method = 'stripe',
  billing_managed_by = 'stripe',
  subscription_start_date = coalesce(public.user_subscriptions.subscription_start_date, excluded.subscription_start_date),
  last_payment_amount = excluded.last_payment_amount,
  updated_at = now();

commit;

-- VERIFY
select
  u.email,
  s.is_paid,
  s.payment_status,
  s.tier_name,
  s.last_payment_amount,
  s.stripe_subscription_id
from auth.users u
join public.user_subscriptions s on s.user_id = u.id
where lower(u.email) = lower('peacebaptist320@gmail.com');
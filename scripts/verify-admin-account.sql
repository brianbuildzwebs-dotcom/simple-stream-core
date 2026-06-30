-- Run in Supabase SQL Editor if login fails with correct email/password.
-- Replace the email below with the one you use on /login.

select
  u.id,
  u.email,
  u.email_confirmed_at,
  u.last_sign_in_at,
  p.role,
  p.full_name
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('brianbuildzwebs@gmail.com');

-- If role is not admin but you need /admin access:
-- update public.profiles set role = 'admin' where id = (
--   select id from auth.users where lower(email) = lower('brianbuildzwebs@gmail.com')
-- );
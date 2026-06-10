-- Run this once after creating your account to unlock the admin dashboard.
-- Replace the email with your registered address.

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'you@example.com'
);
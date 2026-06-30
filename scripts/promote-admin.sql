-- Run AFTER you register at https://simplestreamz.io/register
-- Replace the email with the one you used to sign up.

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where lower(email) = lower('brianbuildzwebs@gmail.com')
);

select u.email, p.role, p.full_name
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('brianbuildzwebs@gmail.com');
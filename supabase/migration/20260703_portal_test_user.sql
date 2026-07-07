-- 20260703_portal_test_user.sql
-- Portal-only test login for /portal dashboard review.
--
-- PREREQUISITE (do this first in Supabase Dashboard → Authentication → Users):
--   Create user: portal-test@ubfreight.com  (set password; do NOT add to staff_users)
--
-- Then apply this migration. It links that auth user to customer CODSH (1,310 shipments).
-- Idempotent: safe to re-run after recreating the auth user (same email).

insert into public.portal_users (user_id, account_id, email)
select u.id, 'CODSH', u.email
from auth.users u
where lower(u.email) = lower('portal-test@ubfreight.com')
on conflict (user_id) do update
  set account_id = excluded.account_id,
      email      = excluded.email;

-- Verify (optional — run manually after apply):
-- select pu.user_id, pu.account_id, pu.email, c.name,
--        (select count(*) from shipments s where s.customer_account_id::text = pu.account_id) as shipments
-- from portal_users pu
-- left join customers c on c.account_id = pu.account_id
-- where pu.email ilike 'portal-test@ubfreight.com';

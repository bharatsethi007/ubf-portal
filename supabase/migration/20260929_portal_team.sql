-- Customer team management in the portal.
--   portal_users.role: 'admin' can invite, change roles and remove people for their own account; 'member' can view the team.
--   Users created by UBF staff, and the first user on an account, become admins automatically.
--   portal_team_list(): the caller's team, for any active portal user. All changes go through the portal-team Edge Function.
-- Idempotent.

alter table public.portal_users add column if not exists role text not null default 'member';
do $$ begin
  alter table public.portal_users add constraint portal_users_role_check check (role in ('admin', 'member'));
exception when duplicate_object then null; end $$;

-- Users UBF staff set up are admins of their account. Customer-invited users default to member.
update public.portal_users set role = 'admin'
 where role = 'member' and status in ('active', 'pending') and invited_by in (select user_id from public.staff_users);

create or replace function public.portal_users_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Staff-created users and the first user on an account are admins.
  if exists (select 1 from public.staff_users where user_id = new.invited_by)
     or not exists (select 1 from public.portal_users where account_id = new.account_id and role = 'admin'
                     and status in ('active', 'pending') and user_id <> new.user_id) then
    new.role := 'admin';
  end if;
  return new;
end $$;
drop trigger if exists trg_portal_users_first_admin on public.portal_users;
create trigger trg_portal_users_first_admin before insert on public.portal_users
  for each row execute function public.portal_users_first_admin();

create or replace function public.portal_team_list()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select account_id, role from public.portal_users where user_id = auth.uid() and status = 'active')
  select jsonb_build_object(
    'my_role', (select role from me),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', u.user_id, 'email', u.email, 'name', u.display_name, 'role', u.role, 'status', u.status,
        'last_login_at', u.last_login_at, 'activated_at', u.activated_at, 'created_at', u.created_at,
        'is_me', u.user_id = auth.uid(),
        'invited_by', case when exists (select 1 from public.staff_users s where s.user_id = u.invited_by) then 'UB Freight'
                           else (select coalesce(i.display_name, i.email) from public.portal_users i where i.user_id = u.invited_by) end,
        'invite_expires_at', (select max(t.expires_at) from public.portal_invite_tokens t where t.user_id = u.user_id and t.used_at is null)
      ) order by (u.status = 'revoked'), (u.role = 'admin') desc, coalesce(u.display_name, u.email))
      from public.portal_users u join me on me.account_id = u.account_id), '[]'::jsonb)
  )
  where exists (select 1 from me)
$$;
revoke all on function public.portal_team_list() from public, anon;
grant execute on function public.portal_team_list() to authenticated;

notify pgrst, 'reload schema';

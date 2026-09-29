-- Staff can change a customer portal user's role from the console (Customers > Info > Portal access).
-- Keeps at least one active admin per account. Applied live 2026-09-30.
create or replace function public.staff_set_portal_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Role must be admin or member'; end if;
  select user_id, account_id, role, status into t from public.portal_users where user_id = p_user_id;
  if not found then raise exception 'Portal user not found'; end if;
  if p_role = 'member' and t.role = 'admin' and t.status = 'active'
     and not exists (select 1 from public.portal_users where account_id = t.account_id and role = 'admin' and status = 'active' and user_id <> p_user_id) then
    raise exception 'This is the only active admin on the account. Make someone else admin first.';
  end if;
  update public.portal_users set role = p_role where user_id = p_user_id;
end $$;
revoke all on function public.staff_set_portal_role(uuid, text) from public, anon;
grant execute on function public.staff_set_portal_role(uuid, text) to authenticated;
notify pgrst, 'reload schema';

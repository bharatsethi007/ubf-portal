-- Portal team profile: name, phone, email per person.
--   portal_users.phone: optional contact number.
--   portal_team_list(): now returns phone.
--   portal_team_update_person(p_user, p_name, p_phone): a person edits their own details; admins edit anyone on their account.
--   Email is the login, so it is not editable here.
-- Idempotent. Run in Supabase Dashboard > SQL Editor.

alter table public.portal_users add column if not exists phone text;
comment on column public.portal_users.display_name is 'Person''s name, shown in the portal greeting and team list.';
comment on column public.portal_users.phone is 'Contact phone, set by the person or an account admin in portal Team.';

create or replace function public.portal_team_list()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select account_id, role from public.portal_users where user_id = auth.uid() and status = 'active')
  select jsonb_build_object(
    'my_role', (select role from me),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', u.user_id, 'email', u.email, 'name', u.display_name, 'phone', u.phone, 'role', u.role, 'status', u.status,
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

create or replace function public.portal_team_update_person(p_user uuid, p_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me public.portal_users%rowtype;
  v_target public.portal_users%rowtype;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  select * into v_me from public.portal_users where user_id = auth.uid() and status = 'active';
  if not found then raise exception 'Not a portal user'; end if;

  select * into v_target from public.portal_users where user_id = p_user and account_id = v_me.account_id;
  if not found then raise exception 'Person not found'; end if;
  if v_target.user_id <> v_me.user_id and v_me.role <> 'admin' then
    raise exception 'Only an admin can change someone else''s details';
  end if;

  if v_name is not null and length(v_name) > 100 then raise exception 'Name is too long'; end if;
  if v_phone is not null and (length(v_phone) > 30 or v_phone !~ '^[0-9+() .-]+$') then
    raise exception 'Phone can only have digits, spaces and + ( ) -';
  end if;

  update public.portal_users set display_name = v_name, phone = v_phone where user_id = v_target.user_id;
  return jsonb_build_object('ok', true, 'name', v_name, 'phone', v_phone);
end $$;
revoke all on function public.portal_team_update_person(uuid, text, text) from public, anon;
grant execute on function public.portal_team_update_person(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

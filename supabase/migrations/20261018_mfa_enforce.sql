-- Security hardening (18 Oct).
-- Gap 1: impersonation sessions ended or past 60 min are revoked in Supabase Auth (every 10 min, and at Return).
-- Gap 2: MFA enforced in the database. Staff access needs an aal2 (two-factor) session, or an active
--        super-admin "Sign in as" session. Before this, a password-only session could call the API directly.
-- Also: 13 old policies checked "row in staff_users" only (ignored disabled staff and MFA). Now use is_staff().
-- Self-test at the end: the whole migration rolls back if a staff MFA session would lose access.

begin;

-- 1. MFA check for the calling session
create or replace function public.staff_mfa_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or exists (select 1 from staff_impersonations i
                 where i.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
                   and i.target_id = auth.uid() and i.ended_at is null and i.expires_at > now());
$$;
grant execute on function public.staff_mfa_ok() to authenticated;

-- 2. Core helpers. Everything else (policies, tower_can, finance.assert_access, RPC guards) goes through these.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from staff_users where user_id = auth.uid() and is_active) and staff_mfa_ok();
$$;

create or replace function public.ubf_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select su.is_admin from staff_users su where su.user_id = auth.uid() and su.is_active), false)
     and staff_mfa_ok();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select su.is_super_admin from staff_users su where su.user_id = auth.uid() and su.is_active), false)
     and staff_mfa_ok();
$$;

create or replace function public.my_companies()
returns setof text language sql stable security definer set search_path = public as $$
  select code from companies where is_super_admin()
  union
  select sc.company_id from staff_companies sc join staff_users su on su.user_id = sc.user_id
  where sc.user_id = auth.uid() and su.is_active and sc.access = 'full' and staff_mfa_ok();
$$;

create or replace function public.has_perm(p_module text, p_op text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean;
  v_super boolean;
  v_ovr   boolean;
  v_role  boolean;
begin
  if v_uid is null then return false; end if;
  if not staff_mfa_ok() then return false; end if;
  select su.is_admin, su.is_super_admin into v_admin, v_super
  from staff_users su where su.user_id = v_uid and su.is_active;
  if v_admin is null then return false; end if;
  if v_super then return true; end if;
  if not module_live(p_module) then return false; end if;
  if v_admin then return true; end if;
  select case p_op when 'read' then o.can_read when 'add' then o.can_add
                   when 'edit' then o.can_edit when 'delete' then o.can_delete else null end
    into v_ovr
  from user_permission_overrides o where o.user_id = v_uid and o.module_key = p_module;
  if v_ovr is not null then return v_ovr; end if;
  select coalesce(bool_or(case p_op when 'read' then rp.can_read when 'add' then rp.can_add
                   when 'edit' then rp.can_edit when 'delete' then rp.can_delete else false end), false)
    into v_role
  from staff_user_roles sur
  join roles r on r.id = sur.role_id and r.is_active
  join role_permissions rp on rp.role_id = sur.role_id and rp.module_key = p_module
  where sur.user_id = v_uid;
  return coalesce(v_role, false);
end $$;

-- 3. Old policies that only checked "row exists in staff_users"
drop policy if exists staff_all_contacts on public.contacts;
create policy staff_all_contacts on public.contacts for select using ((select public.is_staff()));
drop policy if exists staff_all_customer_meta on public.customer_meta;
create policy staff_all_customer_meta on public.customer_meta for all
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists staff_all_customers on public.customers;
create policy staff_all_customers on public.customers for select using ((select public.is_staff()));
drop policy if exists hold_reasons_staff_select on public.hold_reasons;
create policy hold_reasons_staff_select on public.hold_reasons for select using ((select public.is_staff()));
drop policy if exists staff_all_invoices on public.invoices;
create policy staff_all_invoices on public.invoices for select using ((select public.is_staff()));
drop policy if exists staff_read_portal_users on public.portal_users;
create policy staff_read_portal_users on public.portal_users for select using ((select public.is_staff()));
drop policy if exists staff_all_shipments on public.shipments;
create policy staff_all_shipments on public.shipments for select using ((select public.is_staff()));
drop policy if exists sli_attachments_staff on public.sli_attachments;
create policy sli_attachments_staff on public.sli_attachments for all
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists sli_documents_staff on public.sli_documents;
create policy sli_documents_staff on public.sli_documents for all
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists sli_events_staff on public.sli_events;
create policy sli_events_staff on public.sli_events for select using ((select public.is_staff()));
drop policy if exists staff_read_sync_agents on public.sync_agents;
create policy staff_read_sync_agents on public.sync_agents for select using ((select public.is_staff()));
drop policy if exists staff_insert_sync_jobs on public.sync_jobs;
create policy staff_insert_sync_jobs on public.sync_jobs for insert with check ((select public.is_staff()));
drop policy if exists staff_read_sync_jobs on public.sync_jobs;
create policy staff_read_sync_jobs on public.sync_jobs for select using ((select public.is_staff()));

-- 4. RPC guards that checked staff_users directly
do $$
declare f record; d text; nd text;
begin
  for f in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('get_party_intelligence', 'request_sync', 'sync_status', 'system_alert_settings_save')
  loop
    d := pg_get_functiondef(f.oid);
    nd := regexp_replace(d, 'if not exists \(select 1 from (public\.)?staff_users where user_id = auth\.uid\(\)\) then',
                         'if not public.is_staff() then', 'gi');
    nd := regexp_replace(nd, 'if not exists \(select 1 from (public\.)?staff_users where user_id = auth\.uid\(\) and is_admin\) then',
                         'if not public.is_admin() then', 'gi');
    if nd = d then raise exception 'staff guard not found in %', f.proname; end if;
    execute nd;
  end loop;
end $$;

-- 5. Revoke ended / expired impersonation sessions (Gap 1)
create or replace function public.impersonation_cleanup()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with expired as (
    update staff_impersonations set ended_at = now()
    where ended_at is null and expires_at <= now()
    returning id, actor_id, target_id)
  insert into staff_auth_events (user_id, event, actor_id, detail)
  select target_id, 'impersonate_end', actor_id, jsonb_build_object('impersonation_id', id, 'reason', 'expired') from expired;

  delete from auth.sessions s
  using staff_impersonations i
  where s.id = i.session_id and (i.ended_at is not null or i.expires_at <= now());
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.impersonation_cleanup() from public, anon, authenticated;

-- Return also kills the session immediately.
create or replace function public.end_my_impersonation()
returns void language plpgsql security definer set search_path = public as $$
declare r staff_impersonations;
begin
  update staff_impersonations set ended_at = now()
  where session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and target_id = auth.uid() and ended_at is null
  returning * into r;
  if r.id is not null then
    insert into staff_auth_events (user_id, event, actor_id, detail)
    values (r.target_id, 'impersonate_end', r.actor_id, jsonb_build_object('impersonation_id', r.id));
    delete from auth.sessions where id = r.session_id;
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'impersonation-cleanup';
select cron.schedule('impersonation-cleanup', '*/10 * * * *', $$select public.impersonation_cleanup()$$);

-- 6. Self-test. Raises (rolls everything back) if access breaks.
do $$
declare u uuid; s uuid;
begin
  select user_id into u from staff_users where is_active and not is_super_admin limit 1;
  select user_id into s from staff_users where is_active and is_super_admin limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  if not public.is_staff() then raise exception 'SELF-TEST: staff with MFA lost access'; end if;
  if not exists (select 1 from public.my_companies()) then raise exception 'SELF-TEST: staff with MFA has no companies'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  if public.is_staff() then raise exception 'SELF-TEST: password-only session still staff'; end if;
  if public.has_perm('quotes', 'read') then raise exception 'SELF-TEST: password-only session has perms'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  if not public.is_super_admin() then raise exception 'SELF-TEST: super admin lost access'; end if;
  if not public.has_perm('brainbox', 'read') then raise exception 'SELF-TEST: super admin lost module access'; end if;

  perform set_config('request.jwt.claims', '', true);
end $$;

commit;

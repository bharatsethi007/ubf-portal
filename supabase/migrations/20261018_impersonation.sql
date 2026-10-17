-- 1. Super admin sees every module, whatever its rollout status (Off / Pilot / Live).
-- 2. "Sign in as" for super admin (help desk, access checks).
--    Edge fn staff-impersonate mints a session for the target staff user and records it here.
--    The MFA gate accepts that session only while its row is active (60 min), so a password-only
--    login can never skip MFA. Every start/end is logged to staff_auth_events with actor_id.

-- 1. has_perm: super admin short-circuit
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

-- 2. Impersonation sessions (written only by edge fn staff-impersonate with service role)
create table if not exists public.staff_impersonations (
  id         bigserial primary key,
  actor_id   uuid not null,
  target_id  uuid not null,
  session_id uuid not null unique,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at   timestamptz
);
create index if not exists staff_impersonations_target on public.staff_impersonations (target_id, started_at desc);
alter table public.staff_impersonations enable row level security;
drop policy if exists staff_impersonations_read on public.staff_impersonations;
create policy staff_impersonations_read on public.staff_impersonations for select to authenticated
  using (public.is_super_admin());

-- Active impersonation for the caller's own session, else null.
create or replace function public.my_impersonation()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'actor_id', i.actor_id,
    'actor_name', coalesce(nullif(trim(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')), ''), a.full_name, a.email),
    'target_name', coalesce(nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''), t.full_name, t.email),
    'target_email', t.email,
    'expires_at', i.expires_at)
  from staff_impersonations i
  left join staff_users a on a.user_id = i.actor_id
  left join staff_users t on t.user_id = i.target_id
  where i.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
    and i.target_id = auth.uid()
    and i.ended_at is null and i.expires_at > now()
  limit 1;
$$;

-- End the caller's impersonation (called from the banner before switching back).
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
  end if;
end $$;

-- Staff search for the "Sign in as" picker (super admin only).
create or replace function public.impersonation_targets(p_q text default '')
returns table (user_id uuid, name text, email text, job_title text, is_admin boolean, companies text)
language sql stable security definer set search_path = public as $$
  select su.user_id,
         coalesce(nullif(trim(coalesce(su.first_name,'') || ' ' || coalesce(su.last_name,'')), ''), su.full_name, su.email),
         su.email, su.job_title, su.is_admin,
         (select string_agg(sc.company_id, ', ' order by sc.company_id) from staff_companies sc where sc.user_id = su.user_id)
  from staff_users su
  where is_super_admin() and su.is_active and not su.is_super_admin and su.user_id <> auth.uid()
    and (coalesce(p_q, '') = '' or su.email ilike '%' || p_q || '%' or su.full_name ilike '%' || p_q || '%'
         or su.first_name ilike '%' || p_q || '%' or su.last_name ilike '%' || p_q || '%')
  order by 2
  limit 25;
$$;

revoke all on function public.my_impersonation() from public, anon;
revoke all on function public.end_my_impersonation() from public, anon;
revoke all on function public.impersonation_targets(text) from public, anon;
grant execute on function public.my_impersonation() to authenticated;
grant execute on function public.end_my_impersonation() to authenticated;
grant execute on function public.impersonation_targets(text) to authenticated;

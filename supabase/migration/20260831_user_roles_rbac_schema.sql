-- User Roles & Permissions (RBAC) — staff-only, refines is_staff().
-- Module-level permissions: read / add / edit / delete, per role, per module.
-- has_perm() is the single resolver (usable in RLS and UI). staff_users.is_admin = break-glass bypass.
-- ADDITIVE ONLY: does not alter existing policies. Enforcement wired in incrementally.
-- APPLIED LIVE 2026-08-31 via MCP — parity copy, do not re-run.

create table if not exists public.app_modules (
  key text primary key, label text not null, sort_order int not null default 0, is_active boolean not null default true);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(), key text unique, name text not null, description text,
  is_preset boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  can_read boolean not null default false, can_add boolean not null default false,
  can_edit boolean not null default false, can_delete boolean not null default false,
  primary key (role_id, module_key));

create table if not exists public.staff_user_roles (
  user_id uuid not null references public.staff_users(user_id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(), assigned_by uuid,
  primary key (user_id, role_id));
create index if not exists staff_user_roles_role_idx on public.staff_user_roles(role_id);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.staff_users(user_id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  can_read boolean, can_add boolean, can_edit boolean, can_delete boolean,
  primary key (user_id, module_key));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select su.is_admin from staff_users su where su.user_id = auth.uid()), false);
$$;

create or replace function public.has_perm(p_module text, p_op text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_admin boolean; v_ovr boolean; v_role boolean;
begin
  if v_uid is null then return false; end if;
  select su.is_admin into v_admin from staff_users su where su.user_id = v_uid;
  if v_admin is null then return false; end if;
  if v_admin then return true; end if;
  select case p_op when 'read' then o.can_read when 'add' then o.can_add
           when 'edit' then o.can_edit when 'delete' then o.can_delete else null end
    into v_ovr from user_permission_overrides o where o.user_id = v_uid and o.module_key = p_module;
  if v_ovr is not null then return v_ovr; end if;
  select coalesce(bool_or(case p_op when 'read' then rp.can_read when 'add' then rp.can_add
             when 'edit' then rp.can_edit when 'delete' then rp.can_delete else false end), false)
    into v_role from staff_user_roles sur
    join roles r on r.id = sur.role_id and r.is_active
    join role_permissions rp on rp.role_id = sur.role_id and rp.module_key = p_module
    where sur.user_id = v_uid;
  return coalesce(v_role, false);
end; $$;

create or replace function public.can_manage_users()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_perm('users','edit'); $$;

create or replace function public.my_permissions()
returns table(module_key text, label text, sort_order int, can_read boolean, can_add boolean, can_edit boolean, can_delete boolean)
language sql stable security definer set search_path = public as $$
  select m.key, m.label, m.sort_order, public.has_perm(m.key,'read'), public.has_perm(m.key,'add'),
         public.has_perm(m.key,'edit'), public.has_perm(m.key,'delete')
  from app_modules m where m.is_active order by m.sort_order, m.label; $$;

alter table public.app_modules enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;

create policy app_modules_read on public.app_modules for select using (public.is_staff());
create policy app_modules_ins on public.app_modules for insert with check (public.is_admin());
create policy app_modules_upd on public.app_modules for update using (public.is_admin()) with check (public.is_admin());
create policy app_modules_del on public.app_modules for delete using (public.is_admin());
create policy roles_read on public.roles for select using (public.is_staff());
create policy roles_ins on public.roles for insert with check (public.can_manage_users());
create policy roles_upd on public.roles for update using (public.can_manage_users()) with check (public.can_manage_users());
create policy roles_del on public.roles for delete using (public.can_manage_users());
create policy role_perms_read on public.role_permissions for select using (public.is_staff());
create policy role_perms_ins on public.role_permissions for insert with check (public.can_manage_users());
create policy role_perms_upd on public.role_permissions for update using (public.can_manage_users()) with check (public.can_manage_users());
create policy role_perms_del on public.role_permissions for delete using (public.can_manage_users());
create policy sur_read on public.staff_user_roles for select using (public.is_staff());
create policy sur_ins on public.staff_user_roles for insert with check (public.can_manage_users());
create policy sur_upd on public.staff_user_roles for update using (public.can_manage_users()) with check (public.can_manage_users());
create policy sur_del on public.staff_user_roles for delete using (public.can_manage_users());
create policy upo_read on public.user_permission_overrides for select using (public.is_staff());
create policy upo_ins on public.user_permission_overrides for insert with check (public.can_manage_users());
create policy upo_upd on public.user_permission_overrides for update using (public.can_manage_users()) with check (public.can_manage_users());
create policy upo_del on public.user_permission_overrides for delete using (public.can_manage_users());

grant select, insert, update, delete on public.app_modules to authenticated;
grant select, insert, update, delete on public.roles to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select, insert, update, delete on public.staff_user_roles to authenticated;
grant select, insert, update, delete on public.user_permission_overrides to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_perm(text,text) to authenticated;
grant execute on function public.can_manage_users() to authenticated;
grant execute on function public.my_permissions() to authenticated;

insert into public.app_modules(key,label,sort_order) values
  ('control_tower','Control Tower',10),('quotes','Quotes',20),('shipments','Shipments',30),
  ('tms','TMS',40),('bookings','Bookings',50),('customers','Customers',60),('agents','Agents',70),
  ('schedules','Schedules',80),('reports','Reports',90),('rates','Rates',100),
  ('ar','AR / Invoicing',110),('users','Users & Roles',120),('setup','Setup',130)
on conflict (key) do nothing;

insert into public.roles(key,name,description,is_preset) values
  ('admin','Administrator','Full access to every module.',true),
  ('ops','Operations','Day-to-day operations: shipments, TMS, bookings, quotes.',true),
  ('sales','Sales','Quotes, customers and pipeline.',true),
  ('finance','Finance / AR','Invoicing, AR and reporting.',true),
  ('readonly','Read Only','View-only access across the portal.',true),
  ('driver','Driver','Limited access for drivers.',true)
on conflict (key) do nothing;

insert into public.role_permissions(role_id,module_key,can_read,can_add,can_edit,can_delete)
select r.id, m.key, true,true,true,true from public.roles r cross join public.app_modules m
where r.key='admin' on conflict (role_id,module_key) do nothing;

insert into public.role_permissions(role_id,module_key,can_read,can_add,can_edit,can_delete)
select r.id, m.key, true,false,false,false from public.roles r cross join public.app_modules m
where r.key='readonly' on conflict (role_id,module_key) do nothing;

insert into public.role_permissions(role_id,module_key,can_read,can_add,can_edit,can_delete)
select r.id, v.module_key, v.r, v.a, v.e, v.d
from (values
  ('ops','control_tower',true,false,false,false),('ops','quotes',true,true,true,false),
  ('ops','shipments',true,true,true,true),('ops','tms',true,true,true,true),
  ('ops','bookings',true,true,true,true),('ops','customers',true,true,true,false),
  ('ops','agents',true,false,false,false),('ops','schedules',true,true,true,false),
  ('ops','reports',true,false,false,false),('ops','rates',true,false,false,false),('ops','ar',true,false,false,false),
  ('sales','control_tower',true,false,false,false),('sales','quotes',true,true,true,true),
  ('sales','shipments',true,false,false,false),('sales','bookings',true,true,true,false),
  ('sales','customers',true,true,true,false),('sales','agents',true,false,false,false),
  ('sales','schedules',true,false,false,false),('sales','reports',true,false,false,false),('sales','rates',true,false,false,false),
  ('finance','control_tower',true,false,false,false),('finance','quotes',true,false,false,false),
  ('finance','shipments',true,false,false,false),('finance','bookings',true,false,false,false),
  ('finance','customers',true,false,false,false),('finance','agents',true,false,false,false),
  ('finance','schedules',true,false,false,false),('finance','reports',true,true,true,true),
  ('finance','rates',true,false,false,false),('finance','ar',true,true,true,true),
  ('driver','tms',true,false,false,false),('driver','shipments',true,false,false,false)
) as v(role_key,module_key,r,a,e,d)
join public.roles r on r.key = v.role_key on conflict (role_id,module_key) do nothing;

update public.staff_users set is_admin=true where email='bharats@ubfreight.com';
notify pgrst, 'reload schema';

-- Module rollout per company (phases).
-- company_modules(company_id, module_key, status):
--   off   = nobody, not even super admin menus (data untouched)
--   pilot = super admin only
--   live  = everyone, subject to normal role permissions
-- app_modules.super_only = always super admin only, never released (Companies & branches, System health).
-- has_perm() enforces it, so menus, route guard, RLS write policies and RPC checks all follow.
-- Scope = topbar company. "All companies" = live in any of my companies.
-- New modules: insert trigger seeds every company as 'pilot'. Release from Setup > Companies & branches > Modules.

-- 1. Modules
alter table public.app_modules add column if not exists super_only boolean not null default false;

insert into public.app_modules (key, label, sort_order, is_active, super_only) values
  ('companies', 'Companies & branches', 131, true, true),
  ('system_health', 'System health', 132, true, true)
on conflict (key) do update set super_only = true, is_active = true;

-- Only super admin edits the module list itself (roles editor writes role_permissions, not this).
drop policy if exists app_modules_ins on public.app_modules;
drop policy if exists app_modules_upd on public.app_modules;
drop policy if exists app_modules_del on public.app_modules;
create policy app_modules_ins on public.app_modules for insert to authenticated with check (public.is_super_admin());
create policy app_modules_upd on public.app_modules for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy app_modules_del on public.app_modules for delete to authenticated using (public.is_super_admin());

-- 2. Status per company
create table if not exists public.company_modules (
  company_id text not null references public.companies(code) on update cascade on delete cascade,
  module_key text not null references public.app_modules(key) on update cascade on delete cascade,
  status     text not null default 'pilot' check (status in ('off', 'pilot', 'live')),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (company_id, module_key)
);
alter table public.company_modules enable row level security;
drop policy if exists company_modules_read on public.company_modules;
create policy company_modules_read on public.company_modules for select to authenticated using (public.is_staff());
-- Writes only via set_company_module().

-- Shared config table: keep it out of company scoping (scoped views / zz_company_scope).
create or replace function public.company_tables()
returns setof text language sql stable set search_path = public as $$
  select c.table_name::text from information_schema.columns c
  join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
  where c.table_schema = 'public' and c.column_name = 'company_id'
    and c.table_name not in ('branches','staff_companies','agent_company_codes','company_modules');
$$;

-- Seed: NZ live (today's state), FJ/AU pilot. Brainbox pilot everywhere until released.
insert into public.company_modules (company_id, module_key, status)
select c.code, m.key,
       case when m.key = 'brainbox' then 'pilot' when c.code = 'NZ' then 'live' else 'pilot' end
from public.companies c cross join public.app_modules m
where not m.super_only
on conflict (company_id, module_key) do nothing;

update public.company_modules set status = 'pilot', updated_at = now()
where module_key = 'brainbox' and status = 'live';

-- New module or new company: seed missing rows as pilot.
create or replace function public.trg_company_modules_seed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v jsonb := to_jsonb(new);
begin
  insert into company_modules (company_id, module_key, status)
  select c.code, m.key, 'pilot'
  from companies c cross join app_modules m
  where not m.super_only
    and (case when tg_table_name = 'companies' then c.code = v->>'code' else m.key = v->>'key' end)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists company_modules_seed on public.app_modules;
create trigger company_modules_seed after insert on public.app_modules
  for each row execute function public.trg_company_modules_seed();
drop trigger if exists company_modules_seed on public.companies;
create trigger company_modules_seed after insert on public.companies
  for each row execute function public.trg_company_modules_seed();

-- 3. Gate
-- Live for the caller's company scope? (super_only modules are never live)
create or replace function public.module_live(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from company_modules cm join app_modules m on m.key = cm.module_key
    where cm.module_key = p_module and not m.super_only and cm.status = 'live'
      and cm.company_id in (select my_scope()));
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
  select su.is_admin, su.is_super_admin into v_admin, v_super
  from staff_users su where su.user_id = v_uid and su.is_active;
  if v_admin is null then return false; end if;
  if v_super then
    -- Super admin sees pilot modules; 'off' hides a module everywhere in scope.
    return exists (select 1 from app_modules m where m.key = p_module and m.super_only)
        or not exists (select 1 from company_modules cm where cm.module_key = p_module)
        or exists (select 1 from company_modules cm where cm.module_key = p_module
                     and cm.status <> 'off' and cm.company_id in (select my_scope()));
  end if;
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

-- 4. Admin RPCs (super admin)
create or replace function public.company_modules_list()
returns table (module_key text, label text, sort_order int, super_only boolean, company_id text, status text)
language sql stable security definer set search_path = public as $$
  select m.key, m.label, m.sort_order, m.super_only, c.code,
         case when m.super_only then 'super' else coalesce(cm.status, 'pilot') end
  from app_modules m cross join companies c
  left join company_modules cm on cm.module_key = m.key and cm.company_id = c.code
  where is_super_admin() and m.is_active
  order by m.super_only, m.sort_order, m.label, c.sort_order;
$$;

create or replace function public.set_company_module(p_company text, p_module text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'Super admin only'; end if;
  if p_status not in ('off', 'pilot', 'live') then raise exception 'Status must be off, pilot or live'; end if;
  if exists (select 1 from app_modules where key = p_module and super_only) then
    raise exception 'This module is super admin only';
  end if;
  insert into company_modules (company_id, module_key, status, updated_at, updated_by)
  values (p_company, p_module, p_status, now(), auth.uid())
  on conflict (company_id, module_key)
  do update set status = excluded.status, updated_at = now(), updated_by = auth.uid();
end $$;

revoke all on function public.set_company_module(text, text, text) from public, anon;
revoke all on function public.company_modules_list() from public, anon;
grant execute on function public.set_company_module(text, text, text) to authenticated;
grant execute on function public.company_modules_list() to authenticated;
grant execute on function public.module_live(text) to authenticated;

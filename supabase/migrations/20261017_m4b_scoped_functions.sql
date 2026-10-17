-- M4b Company scope inside server functions.
-- Server functions (SECURITY DEFINER) run as postgres, which bypasses row security, so the
-- company switcher did not reach Control Tower, reports, inbox counts etc.
-- Fix without rewriting 190 function bodies:
--   schema `scoped` holds one view per company-owned table:
--     scoped.<t> = public.<t> filtered to scope_companies()
--   staff function search_path becomes 'scoped, public', so unqualified table names in
--   those functions resolve to the filtered views. Writes pass through (auto-updatable views).
--   scope_companies(): staff -> switcher scope (one company or all theirs);
--                      portal users, cron, sync, service role -> every company (unchanged).
-- Rules from now:
--   * new staff RPC: `set search_path = scoped, public`
--   * new or replaced staff view: run its CREATE with `set local search_path = scoped, public`
--   * after adding/dropping columns on an owned table: `select public.sync_scoped_views();`
--   * cross-company work (network shipments): write public.<table> explicitly.
-- Undo: see bottom.

begin;

create schema if not exists scoped;
revoke all on schema scoped from public, anon, authenticated;

create or replace function public.scope_companies() returns setof text
language sql stable security definer set search_path = public as $$
  select c.code from companies c
  where not coalesce(is_staff(), false) or c.code in (select my_scope());
$$;
grant execute on function public.scope_companies() to authenticated;

create or replace function public.sync_scoped_views() returns integer
language plpgsql security definer set search_path = public as $$
declare t text; n int := 0;
begin
  for t in
    select c.table_name from information_schema.columns c
    join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
    where c.table_schema = 'public' and c.column_name = 'company_id'
      and c.table_name not in ('branches','staff_companies','agent_company_codes')
  loop
    begin
      execute format('create or replace view scoped.%I as select * from public.%I
                      where company_id in (select public.scope_companies())', t, t);
    exception when others then      -- column dropped or reordered: rebuild
      execute format('drop view if exists scoped.%I', t);
      execute format('create view scoped.%I as select * from public.%I
                      where company_id in (select public.scope_companies())', t, t);
    end;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sync_scoped_views() from public, anon, authenticated;

select public.sync_scoped_views();

-- Point staff server functions at the scoped views.
do $$
declare r record; cfg text; newp text;
  skip text[] := array['is_staff','is_admin','has_perm','my_permissions','my_account_id','tms_driver_id',
    'current_company','current_branch','my_scope','my_companies','has_company','set_my_company',
    'my_company_context','scope_companies','sync_scoped_views','next_ref_no',
    'fin_stage_reset','fin_stage_load','fin_stage_commit','fin_whitelist','rls_auto_enable'];
begin
  for r in
    select p.oid, p.oid::regprocedure as sig,
           (select x from unnest(p.proconfig) x where x like 'search_path=%') as sp
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and p.proname <> all (skip)
      and exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%')
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.column_name = 'company_id'
          and c.table_name not in ('branches','staff_companies','agent_company_codes')
          and p.prosrc ~* ('\m' || c.table_name || '\M'))
  loop
    cfg := substr(r.sp, length('search_path=') + 1);
    continue when cfg ~ '\mscoped\M';
    newp := regexp_replace(cfg, '\mpublic\M', 'scoped, public');
    continue when newp = cfg;               -- no public in path
    execute format('alter function %s set search_path = %s', r.sig, newp);
  end loop;
end $$;

-- Staff views (v_*) run as their owner too. Re-create them with scoped first in the path,
-- so their table references bind to the scoped views. Same columns, same names.
do $$
declare r record; defs jsonb := '{}'; k text;
begin
  for r in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' and c.relname like 'v\_%'
      and not coalesce((select option_value = 'true' from pg_options_to_table(c.reloptions)
                        where option_name = 'security_invoker'), false)
  loop
    defs := defs || jsonb_build_object(r.relname, pg_get_viewdef(('public.' || quote_ident(r.relname))::regclass));
  end loop;
  perform set_config('search_path', 'scoped, public, extensions', true);
  for k in select jsonb_object_keys(defs) loop
    execute format('create or replace view public.%I as %s', k, defs->>k);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';

-- Verify:
-- select count(*) from pg_proc where array_to_string(proconfig, ',') like '%scoped%';
-- Undo (functions back to old path):
-- do $$ declare r record; begin for r in select oid::regprocedure sig,
--   replace((select x from unnest(proconfig) x where x like 'search_path=%'), 'search_path=', '') sp
--   from pg_proc where array_to_string(proconfig, ',') like '%scoped%' loop
--   execute format('alter function %s set search_path = %s', r.sig, replace(r.sp, 'scoped, ', '')); end loop; end $$;

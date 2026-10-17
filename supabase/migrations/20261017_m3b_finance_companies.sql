-- M3b Finance per company.
-- Finance functions write `finance.<table>` fully qualified, so search_path cannot scope them.
-- Instead: real tables move to schema finance_data (+ company_id, keys include company_id),
-- and finance.<table> becomes a view filtered to scope_companies(). Every existing finance
-- function, report and view keeps its SQL and now sees only the picked company.
-- Sync: stage/commit work per company (delete + insert that company's rows, no truncate),
-- so loading FJ never touches NZ. sync_finance.py passes --company.
-- Cron, sync and service role see every company (unchanged).
-- Idempotent. Safe to re-run.

begin;

create schema if not exists finance_data;
revoke all on schema finance_data from public, anon, authenticated;

-- 1. Capture finance views, move tables, add company_id ------------------------
create temp table _fin_views on commit drop as
  select c.relname::text as name, pg_get_viewdef(c.oid) as def
  from pg_class c where c.relnamespace = 'finance'::regnamespace and c.relkind = 'v'
    and c.relname like 'v\_%';

do $$
declare t text;
begin
  for t in select c.relname from pg_class c where c.relnamespace = 'finance'::regnamespace and c.relkind = 'r' loop
    execute format('alter table finance.%I add column if not exists company_id text not null default %L', t, 'NZ');
    execute format('alter table finance.%I set schema finance_data', t);
  end loop;
end $$;

-- 2. Keys include company; default = writer's company --------------------------
do $$
declare r record; cols text;
begin
  for r in
    select k.conname, c.relname, k.oid as conoid
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    where k.contype = 'p' and c.relnamespace = 'finance_data'::regnamespace
      and not exists (select 1 from unnest(k.conkey) a join pg_attribute at on at.attrelid = k.conrelid and at.attnum = a
                      where at.attname = 'company_id')
  loop
    select string_agg(quote_ident(at.attname), ', ' order by x.ord) into cols
    from pg_constraint k
    cross join lateral unnest(k.conkey) with ordinality x(a, ord)
    join pg_attribute at on at.attrelid = k.conrelid and at.attnum = x.a
    where k.oid = r.conoid;
    execute format('alter table finance_data.%I drop constraint %I', r.relname, r.conname);
    execute format('alter table finance_data.%I add constraint %I primary key (company_id, %s)', r.relname, r.conname, cols);
  end loop;

  for r in select c.relname from pg_class c
           where c.relnamespace = 'finance_data'::regnamespace and c.relkind = 'r' and c.relname not like '%\_\_stg' loop
    execute format('alter table finance_data.%I alter column company_id set default public.current_company()', r.relname);
    if not exists (select 1 from pg_constraint where conname = r.relname || '_company_id_fkey'
                   and conrelid = ('finance_data.' || r.relname)::regclass) then
      execute format('alter table finance_data.%I add constraint %I foreign key (company_id) references public.companies(code)',
                     r.relname, r.relname || '_company_id_fkey');
    end if;
  end loop;
end $$;

-- 3. finance.<table> = company-scoped view --------------------------------------
create or replace function public.sync_finance_views() returns integer
language plpgsql security definer set search_path = public as $$
declare t text; n int := 0;
begin
  for t in select c.relname from pg_class c
           where c.relnamespace = 'finance_data'::regnamespace and c.relkind = 'r' and c.relname not like '%\_\_stg' loop
    begin
      execute format('create or replace view finance.%I as select * from finance_data.%I
                      where company_id in (select public.scope_companies())', t, t);
    exception when others then
      execute format('drop view if exists finance.%I cascade', t);
      execute format('create view finance.%I as select * from finance_data.%I
                      where company_id in (select public.scope_companies())', t, t);
    end;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sync_finance_views() from public, anon, authenticated;
select public.sync_finance_views();

-- Re-point the finance report views at the scoped views.
do $$
declare r record;
begin
  perform set_config('search_path', 'finance, public', true);
  for r in select * from _fin_views loop
    execute format('create or replace view finance.%I as %s', r.name,
                   replace(r.def, 'finance_data.', 'finance.'));
  end loop;
  perform set_config('search_path', 'public', true);
end $$;

-- 4. Stage / commit per company -------------------------------------------------
drop function if exists public.fin_stage_reset(text);
drop function if exists public.fin_stage_load(text, jsonb);
drop function if exists public.fin_stage_commit(text, date);

create or replace function public.fin_stage_reset(p_table text, p_company text default 'NZ') returns void
language plpgsql security definer set search_path = finance_data, public as $$
begin
  if not public.fin_whitelist(p_table) then raise exception 'bad table %', p_table; end if;
  execute format('delete from finance_data.%I where company_id = $1', p_table || '__stg') using p_company;
end $$;

create or replace function public.fin_stage_load(p_table text, p_rows jsonb, p_company text default 'NZ') returns integer
language plpgsql security definer set search_path = finance_data, public as $$
declare n integer; v jsonb;
begin
  if not public.fin_whitelist(p_table) then raise exception 'bad table %', p_table; end if;
  select coalesce(jsonb_agg(e || jsonb_build_object('company_id', p_company)), '[]'::jsonb) into v
  from jsonb_array_elements(p_rows) e;
  execute format('insert into finance_data.%1$I select * from jsonb_populate_recordset(null::finance_data.%1$I, $1)',
                 p_table || '__stg') using v;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.fin_stage_commit(p_table text, p_from date, p_company text default 'NZ') returns integer
language plpgsql security definer set search_path = finance_data, public as $$
declare n integer; cols text;
begin
  if not public.fin_whitelist(p_table) then raise exception 'bad table %', p_table; end if;
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into cols
  from pg_attribute a
  where a.attrelid = ('finance_data.' || p_table)::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = '';
  execute format('delete from finance_data.%I where company_id = $1', p_table) using p_company;
  execute format('insert into finance_data.%I (%s) select %s from finance_data.%I where company_id = $1',
                 p_table, cols, cols, p_table || '__stg') using p_company;
  get diagnostics n = row_count;
  execute format('delete from finance_data.%I where company_id = $1', p_table || '__stg') using p_company;
  insert into finance_data.sync_state (company_id, table_name, rows, from_date, synced_at)
  values (p_company, p_table, n, p_from, now())
  on conflict (company_id, table_name) do update
    set rows = excluded.rows, from_date = excluded.from_date, synced_at = excluded.synced_at;
  return n;
end $$;

revoke all on function public.fin_stage_reset(text, text) from public, anon, authenticated;
revoke all on function public.fin_stage_load(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.fin_stage_commit(text, date, text) from public, anon, authenticated;
grant execute on function public.fin_stage_reset(text, text) to service_role;
grant execute on function public.fin_stage_load(text, jsonb, text) to service_role;
grant execute on function public.fin_stage_commit(text, date, text) to service_role;

-- 5. Finance review RPCs: conflict targets now include company -------------------
do $$
declare r record; def text; pairs text[][] := array[
  array['fin_setting_set',  'on conflict (key)',             'on conflict (company_id, key)'],
  array['fin_leak_review',  'on conflict (job_no, category)', 'on conflict (company_id, job_no, category)'],
  array['fin_match_review', 'on conflict (receipt_id)',      'on conflict (company_id, receipt_id)'],
  array['fin_close_review', 'on conflict (month, code)',     'on conflict (company_id, month, code)'],
  array['fin_close_month',  'on conflict (month)',           'on conflict (company_id, month)']];
  i int;
begin
  for i in 1 .. array_length(pairs, 1) loop
    for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = pairs[i][1] loop
      def := pg_get_functiondef(r.oid);
      if position(pairs[i][2] in def) > 0 then
        execute replace(def, pairs[i][2], pairs[i][3]);
      end if;
    end loop;
  end loop;
end $$;

-- 6. apply_company_scope also refreshes finance views -----------------------------
create or replace function public.apply_company_scope() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare r record; cfg text; newp text; nv int := 0; nf int := 0; nw int := 0; nfin int := 0;
  defs jsonb := '{}'; k text;
  skip text[] := array['is_staff','is_admin','is_super_admin','has_perm','my_permissions','my_account_id',
    'tms_driver_id','current_company','current_branch','my_scope','my_companies','has_company',
    'set_my_company','my_company_context','scope_companies','sync_scoped_views','sync_finance_views',
    'apply_company_scope','company_tables','inherit_company','next_ref_no','staff_in_scope',
    'staff_join_my_company','my_view_branch','set_my_branch','get_branding',
    'fin_stage_reset','fin_stage_load','fin_stage_commit','fin_whitelist','rls_auto_enable'];
begin
  nv := public.sync_scoped_views();
  nfin := public.sync_finance_views();

  for r in
    select p.oid::regprocedure as sig, (select x from unnest(p.proconfig) x where x like 'search_path=%') as sp
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.proname <> all (skip)
      and exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%')
      and exists (select 1 from company_tables() ct where p.prosrc ~* ('\m' || ct || '\M'))
  loop
    cfg := substr(r.sp, length('search_path=') + 1);
    continue when cfg ~ '\mscoped\M';
    newp := regexp_replace(cfg, '\mpublic\M', 'scoped, public');
    continue when newp = cfg;
    execute format('alter function %s set search_path = %s', r.sig, newp);
    nf := nf + 1;
  end loop;

  perform set_config('search_path', 'public, extensions', true);
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
    nw := nw + 1;
  end loop;
  perform set_config('search_path', 'public', true);
  return jsonb_build_object('views', nv, 'finance_views', nfin, 'functions_switched', nf, 'staff_views', nw);
end $fn$;
revoke all on function public.apply_company_scope() from public, anon, authenticated;

select public.apply_company_scope();

commit;

notify pgrst, 'reload schema';

-- Verify:
-- select company_id, count(*) from finance_data.gl_trans group by 1;
-- select table_name, company_id, rows, synced_at from finance.sync_state order by 1;

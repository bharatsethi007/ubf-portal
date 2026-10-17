-- M4c Close remaining company gaps + super admin.
--  1. Super admin (Bharat): only role that sees every company and edits Companies & branches.
--     Ordinary admins see only companies they are given.
--  2. company_id on every child table (quote lines, CSAT responses, inbox messages, rate card
--     lines, TMS events...) plus brainbox learning (ai_corrections, ai_proposals,
--     brainbox_card_changes, erp_charge_map) and exchange_rates. Child rows inherit the
--     parent's company on insert. Existing rows NZ.
--  3. Exchange rates per company (own buy/sell corrections). FJ/AU seeded from NZ.
--     Daily FX job updates every company. ERP charge code map per company (own FDB).
--  4. Users: list shows staff of the picked company. New staff join the creator's company.
--  5. apply_company_scope(): one call re-applies scoped views, functions and staff views.
--     Run it at the end of any migration that adds a table, column, RPC or view.
-- Idempotent. Safe to re-run.

begin;

-- 1. Super admin ---------------------------------------------------------------
alter table public.staff_users add column if not exists is_super_admin boolean not null default false;
update public.staff_users set is_super_admin = true
 where user_id = '247731de-aec4-4320-9128-79901166b303' and not is_super_admin;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select su.is_super_admin from staff_users su where su.user_id = auth.uid() and su.is_active), false);
$$;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.my_companies() returns setof text
language sql stable security definer set search_path = public as $$
  select code from companies where is_super_admin()
  union
  select sc.company_id from staff_companies sc join staff_users su on su.user_id = sc.user_id
  where sc.user_id = auth.uid() and su.is_active and sc.access = 'full';
$$;

create or replace function public.has_company(p_company text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_company in (select my_companies());
$$;

create or replace function public.my_company_context() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'current', (select sc.company_id from staff_companies sc
                 where sc.user_id = auth.uid() and sc.is_default and sc.access = 'full' limit 1),
    'is_admin', is_admin(),
    'is_super_admin', is_super_admin(),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name,
                   'is_active', c.is_active, 'currency', c.base_currency) order by c.sort_order)
                 from companies c where c.code in (select my_companies())), '[]'::jsonb));
$$;

-- Companies, branches, staff access: super admin writes. Staff read access rows of their scope.
drop policy if exists companies_admin on public.companies;
create policy companies_admin on public.companies for all to authenticated
  using (is_super_admin()) with check (is_super_admin());
drop policy if exists branches_admin on public.branches;
create policy branches_admin on public.branches for all to authenticated
  using (is_super_admin()) with check (is_super_admin());
drop policy if exists staff_companies_admin on public.staff_companies;
create policy staff_companies_admin on public.staff_companies for all to authenticated
  using (is_super_admin()) with check (is_super_admin());
drop policy if exists staff_companies_read on public.staff_companies;
create policy staff_companies_read on public.staff_companies for select to authenticated
  using (user_id = auth.uid() or is_super_admin() or company_id in (select my_scope()));

-- Staff in the picked company (Users page).
create or replace function public.staff_in_scope() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct sc.user_id from staff_companies sc
  where is_staff() and sc.company_id in (select my_scope());
$$;
grant execute on function public.staff_in_scope() to authenticated;

-- New staff member joins the creator's company and branch (called after create).
create or replace function public.staff_join_my_company(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('users', 'add') then raise exception 'not allowed'; end if;
  insert into staff_companies (user_id, company_id, access, is_default, home_branch)
  values (p_user_id, current_company(), 'full',
          not exists (select 1 from staff_companies where user_id = p_user_id and is_default),
          current_branch())
  on conflict (user_id, company_id) do nothing;
end $$;
grant execute on function public.staff_join_my_company(uuid) to authenticated;

-- 2. company_id on child + learning tables -------------------------------------
create or replace function public.company_tables() returns setof text
language sql stable set search_path = public as $$
  select c.table_name::text from information_schema.columns c
  join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
  where c.table_schema = 'public' and c.column_name = 'company_id'
    and c.table_name not in ('branches','staff_companies','agent_company_codes');
$$;

create or replace function public.inherit_company() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  -- tg_argv: parent table, parent column, child column, parent column type
  k := to_jsonb(new) ->> tg_argv[2];
  if k is not null then
    execute format('select company_id from public.%I where %I = $1::%s', tg_argv[0], tg_argv[1], tg_argv[3])
      into v using k;
    if v is not null then new.company_id := v; end if;
  end if;
  return new;
end $$;

do $$
declare r record; t text;
  extra text[] := array['ai_corrections','ai_proposals','brainbox_card_changes','erp_charge_map','exchange_rates'];
begin
  -- children: first NOT NULL FK to a company table wins, else first FK
  for r in
    with owned as (select company_tables() as tbl),
    fk as (
      select cl.relname::text child, pl.relname::text parent, ca.attname::text ccol, pa.attname::text pcol,
             format_type(pa.atttypid, pa.atttypmod) ptype,
             row_number() over (partition by cl.relname order by ca.attnotnull desc, c.conname) rn
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid join pg_class pl on pl.oid = c.confrelid
      join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = c.conkey[1]
      join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace and cardinality(c.conkey) = 1
        and cl.relkind = 'r' and pl.relname in (select tbl from owned) and cl.relname not in (select tbl from owned)
        and cl.relname not in ('branches','staff_companies','agent_company_codes','companies'))
    select * from fk where rn = 1
  loop
    execute format('alter table public.%I add column if not exists company_id text not null default %L', r.child, 'NZ');
    execute format('drop trigger if exists zz_inherit_company on public.%I', r.child);
    execute format('create trigger zz_inherit_company before insert on public.%I for each row
                    execute function public.inherit_company(%L, %L, %L, %L)', r.child, r.parent, r.pcol, r.ccol, r.ptype);
  end loop;

  foreach t in array extra loop
    continue when to_regclass('public.' || t) is null;
    execute format('alter table public.%I add column if not exists company_id text not null default %L', t, 'NZ');
  end loop;

  -- every company table: default, FK, simple scope policy (replaces child exists-policies)
  for t in select company_tables() loop
    execute format('alter table public.%I alter column company_id set default public.current_company()', t);
    if not exists (select 1 from pg_constraint where conname = t || '_company_id_fkey' and conrelid = ('public.' || t)::regclass) then
      execute format('alter table public.%I add constraint %I foreign key (company_id) references public.companies(code) not valid', t, t || '_company_id_fkey');
      execute format('alter table public.%I validate constraint %I', t, t || '_company_id_fkey');
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists zz_company_scope on public.%I', t);
    execute format($p$create policy zz_company_scope on public.%I as restrictive for all to authenticated
      using (not (select is_staff()) or company_id in (select my_scope()))
      with check (not (select is_staff()) or company_id in (select my_companies()))$p$, t);
  end loop;
end $$;

-- 3. Exchange rates + ERP charge map keyed per company -------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.exchange_rates'::regclass
                  and contype = 'p' and pg_get_constraintdef(oid) like '%company_id%') then
    alter table public.exchange_rates drop constraint exchange_rates_pkey;
    alter table public.exchange_rates add constraint exchange_rates_pkey primary key (company_id, base_currency, quote_currency);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.erp_charge_map'::regclass
                  and contype = 'p' and pg_get_constraintdef(oid) like '%company_id%') then
    alter table public.erp_charge_map drop constraint erp_charge_map_pkey;
    alter table public.erp_charge_map add constraint erp_charge_map_pkey primary key (company_id, erp_code);
  end if;
end $$;

insert into public.exchange_rates (company_id, base_currency, quote_currency, rate, as_of, source, updated_at,
                                   buy_correction_pct, sell_correction_pct)
select c.code, x.base_currency, x.quote_currency, x.rate, x.as_of, x.source, now(),
       x.buy_correction_pct, x.sell_correction_pct
from public.exchange_rates x cross join public.companies c
where x.company_id = 'NZ' and c.code <> 'NZ'
on conflict do nothing;

create or replace function public.fx_apply() returns text
language plpgsql security definer set search_path = public as $$
declare
  req_id bigint; resp record; payload jsonb; rates jsonb;
  base_cur text; quote_cur text; r numeric; n int := 0; msg text;
begin
  if auth.uid() is not null and not is_staff() then raise exception 'fx: staff only'; end if;
  select last_request_id into req_id from public.fx_sync_state where id = 1;
  if req_id is null then return 'fx_apply: no request on record'; end if;
  select * into resp from net._http_response where id = req_id;
  if not found then return 'fx_apply: response not ready yet'; end if;
  if resp.status_code <> 200 then
    msg := 'fx_apply: http ' || resp.status_code;
    update public.fx_sync_state set last_applied_at = now(), last_result = msg where id = 1;
    return msg;
  end if;
  payload := resp.content::jsonb;
  if payload->>'result' <> 'success' then
    msg := 'fx_apply: api not success';
    update public.fx_sync_state set last_applied_at = now(), last_result = msg where id = 1;
    return msg;
  end if;
  rates := payload->'rates';
  for base_cur in select code from public.currencies where active loop
    if rates ? base_cur then
      for quote_cur in select code from public.currencies where active loop
        if rates ? quote_cur then
          r := (rates->>base_cur)::numeric / nullif((rates->>quote_cur)::numeric, 0);
          if r is not null then
            -- same market rate for every company; each keeps its own buy/sell corrections
            insert into public.exchange_rates (company_id, base_currency, quote_currency, rate, as_of, source, updated_at)
            select c.code, base_cur, quote_cur, round(r, 6), current_date, 'open.er-api.com', now()
            from public.companies c
            on conflict (company_id, base_currency, quote_currency) do update
              set rate = excluded.rate, as_of = excluded.as_of, source = excluded.source, updated_at = now();
            n := n + 1;
          end if;
        end if;
      end loop;
    end if;
  end loop;
  msg := 'fx_apply: upserted ' || n || ' pairs';
  update public.fx_sync_state set last_applied_at = now(), last_result = msg where id = 1;
  return msg;
end $$;

-- 5. One call to (re)apply company scope to views, functions, staff views ----------
create or replace function public.apply_company_scope() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare r record; t text; cfg text; newp text; nv int := 0; nf int := 0; nw int := 0;
  defs jsonb := '{}'; k text;
  skip text[] := array['is_staff','is_admin','is_super_admin','has_perm','my_permissions','my_account_id',
    'tms_driver_id','current_company','current_branch','my_scope','my_companies','has_company',
    'set_my_company','my_company_context','scope_companies','sync_scoped_views','apply_company_scope',
    'company_tables','inherit_company','next_ref_no','staff_in_scope','staff_join_my_company',
    'fin_stage_reset','fin_stage_load','fin_stage_commit','fin_whitelist','rls_auto_enable'];
begin
  nv := public.sync_scoped_views();

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

  for r in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' and c.relname like 'v\_%'
      and not coalesce((select option_value = 'true' from pg_options_to_table(c.reloptions)
                        where option_name = 'security_invoker'), false)
  loop
    perform set_config('search_path', 'public, extensions', true);
    defs := defs || jsonb_build_object(r.relname, pg_get_viewdef(('public.' || quote_ident(r.relname))::regclass));
  end loop;
  perform set_config('search_path', 'scoped, public, extensions', true);
  for k in select jsonb_object_keys(defs) loop
    execute format('create or replace view public.%I as %s', k, defs->>k);
    nw := nw + 1;
  end loop;
  perform set_config('search_path', 'public', true);
  return jsonb_build_object('views', nv, 'functions_switched', nf, 'staff_views', nw);
end $fn$;
revoke all on function public.apply_company_scope() from public, anon, authenticated;

-- sync_scoped_views uses company_tables() from now on
create or replace function public.sync_scoped_views() returns integer
language plpgsql security definer set search_path = public as $$
declare t text; n int := 0;
begin
  for t in select company_tables() loop
    begin
      execute format('create or replace view scoped.%I as select * from public.%I
                      where company_id in (select public.scope_companies())', t, t);
    exception when others then
      execute format('drop view if exists scoped.%I', t);
      execute format('create view scoped.%I as select * from public.%I
                      where company_id in (select public.scope_companies())', t, t);
    end;
    n := n + 1;
  end loop;
  return n;
end $$;

select public.apply_company_scope();

commit;

notify pgrst, 'reload schema';

-- Verify:
-- select count(*) from company_tables();                   -- ~120
-- select company_id, count(*) from exchange_rates group by 1;

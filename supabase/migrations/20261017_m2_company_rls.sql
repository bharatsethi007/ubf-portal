-- M2 Company row security.
-- Adds RESTRICTIVE policies on top of existing ones. Existing policies untouched.
--   Owned tables (company_id): staff only see rows of their companies. Admin sees all.
--   Child tables (FK to owned table): staff only see rows whose parent they can see.
-- Portal users, drivers, anon: unaffected (rules only apply to staff).
-- Service role (sync, edge fns) bypasses RLS as before.
-- NOT covered: SECURITY DEFINER RPCs and non-invoker views bypass RLS. Swept in M4
-- (p_company params) before any FJ/AU staff get access.
-- Idempotent. Safe to re-run. Undo: drop policies named zz_company_scope.

begin;

-- 1. my_companies: full access only (network_viewer gets network legs in M6)
create or replace function public.my_companies()
returns setof text language sql stable security definer set search_path = public as $$
  select code from companies where is_admin()
  union
  select sc.company_id from staff_companies sc join staff_users su on su.user_id = sc.user_id
  where sc.user_id = auth.uid() and su.is_active and sc.access = 'full';
$$;

-- 2. Owned tables ------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
    where c.table_schema = 'public' and c.column_name = 'company_id'
      and c.table_name not in ('branches','staff_companies','agent_company_codes')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists zz_company_scope on public.%I', t);
    execute format($p$create policy zz_company_scope on public.%I as restrictive for all to authenticated
      using (not (select is_staff()) or company_id in (select my_companies()))
      with check (not (select is_staff()) or company_id in (select my_companies()))$p$, t);
  end loop;
end $$;

-- 3. Child tables: row visible to staff only if every referenced owned parent is visible
do $$
declare r record;
begin
  for r in
    with owned as (
      select c.table_name::text t from information_schema.columns c
      join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
      where c.table_schema = 'public' and c.column_name = 'company_id'
        and c.table_name not in ('branches','staff_companies','agent_company_codes')),
    fk as (
      select cl.relname::text child, pl.relname::text parent, ca.attname::text ccol, pa.attname::text pcol
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_class pl on pl.oid = c.confrelid
      join pg_attribute ca on ca.attrelid = c.conrelid and ca.attnum = c.conkey[1]
      join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and cardinality(c.conkey) = 1 and cl.relkind = 'r'
        and pl.relname in (select t from owned) and cl.relname not in (select t from owned)
        and cl.relname not in ('branches','staff_companies','agent_company_codes'))
    select child,
      string_agg(format('(%2$I.%3$I is null or exists (select 1 from public.%1$I p where p.%4$I = %2$I.%3$I))',
                        parent, child, ccol, pcol), ' and ' order by parent, ccol) as expr
    from fk group by child
  loop
    execute format('alter table public.%I enable row level security', r.child);
    execute format('drop policy if exists zz_company_scope on public.%I', r.child);
    execute format($p$create policy zz_company_scope on public.%I as restrictive for all to authenticated
      using (not (select is_staff()) or (select is_admin()) or (%s))
      with check (not (select is_staff()) or (select is_admin()) or (%s))$p$, r.child, r.expr, r.expr);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';

-- Verify:
-- select tablename from pg_policies where policyname = 'zz_company_scope' order by 1;

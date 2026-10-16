-- M3 Company-aware ERP keys.
-- Each company has its own TradeWindow FDB, so ERP ids and codes collide across companies.
-- Keys are namespaced at sync time, so every existing FK, join and unique key keeps working:
--   integer ERP ids  + companies.key_offset   NZ 0, FJ 1e12, AU 2e12
--   text ERP codes   + companies.key_prefix   NZ '', FJ 'FJ:', AU 'AU:'
-- NZ is identity: no NZ value changes. Display helpers erp_key()/erp_code() strip the namespace.
-- Also: consol_key carries the prefix; staff policies on big tables evaluate auth once per query.
-- Finance schema unchanged (M3b). Idempotent. Safe to re-run.

begin;

-- 1. Namespace config per company -----------------------------------------
alter table public.companies add column if not exists key_offset bigint;
alter table public.companies add column if not exists key_prefix text;
alter table public.companies add column if not exists erp_exclude_accounts text[] not null default '{}';

update public.companies set key_offset = 0,                 key_prefix = ''    where code = 'NZ' and key_offset is null;
update public.companies set key_offset = 1000000000000,     key_prefix = 'FJ:' where code = 'FJ' and key_offset is null;
update public.companies set key_offset = 2000000000000,     key_prefix = 'AU:' where code = 'AU' and key_offset is null;
update public.companies set erp_exclude_accounts = '{UBNAN}' where code = 'NZ' and erp_exclude_accounts = '{}';

alter table public.companies alter column key_offset set not null;
alter table public.companies alter column key_prefix set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'companies_key_offset_key') then
    alter table public.companies add constraint companies_key_offset_key unique (key_offset);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_key_prefix_chk') then
    alter table public.companies add constraint companies_key_prefix_chk
      check (key_prefix = case when key_offset = 0 then '' else code || ':' end);
  end if;
end $$;

-- 2. Display helpers ---------------------------------------------------------
create or replace function public.erp_key(p bigint) returns bigint
language sql immutable parallel safe as $$ select p % 1000000000000 $$;

create or replace function public.erp_code(p text) returns text
language sql immutable parallel safe as $$ select regexp_replace(p, '^[A-Z]{2}:', '') $$;

grant execute on function public.erp_key(bigint) to authenticated, anon;
grant execute on function public.erp_code(text) to authenticated, anon;

commit;

-- 3. consol_key carries company prefix (NZ values unchanged). PG17 SET EXPRESSION,
--    dependent views and matviews stay in place. Rewrites shipments + shipment_legs.
alter table public.shipments alter column consol_key set expression as (
  case when shipment_no is not null
       then (case when company_id = 'NZ' then '' else company_id || ':' end) || module || '-' || shipment_no::text
  end);
alter table public.shipment_legs alter column consol_key set expression as (
  case when shipment_no is not null
       then (case when company_id = 'NZ' then '' else company_id || ':' end) || module || '-' || shipment_no::text
  end);

-- 4. Staff policies on big tables: wrap auth calls in (SELECT ...) so Postgres runs them
--    once per query, not once per row (job_charges full scan 27s -> ~1s).
do $$
declare r record; q text; c text; pat text := '(?<!SELECT )\m(is_staff|is_admin|my_account_id|tms_driver_id)\(\)';
begin
  for r in
    select p.tablename, p.policyname, p.cmd, p.qual, p.with_check
    from pg_policies p join pg_class k on k.relname = p.tablename and k.relnamespace = 'public'::regnamespace
    where p.schemaname = 'public' and k.reltuples > 5000
      and (coalesce(p.qual,'') ~ pat or coalesce(p.with_check,'') ~ pat
           or coalesce(p.qual,'') ~ '(?<!SELECT )auth\.uid\(\)' or coalesce(p.with_check,'') ~ '(?<!SELECT )auth\.uid\(\)')
  loop
    q := regexp_replace(regexp_replace(r.qual, pat, '(SELECT \1())', 'g'), '(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    c := regexp_replace(regexp_replace(r.with_check, pat, '(SELECT \1())', 'g'), '(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    if q is not null and c is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, q, c);
    elsif q is not null then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, q);
    elsif c is not null then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, c);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verify:
-- select code, key_offset, key_prefix, erp_exclude_accounts from companies order by sort_order;
-- select count(*) from shipments where consol_key like '%:%';   -- expect 0 until FJ syncs

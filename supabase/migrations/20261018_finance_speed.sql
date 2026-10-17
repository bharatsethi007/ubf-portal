-- Finance reports: fast per company. FJ CFO overview hit the 8s API limit.
-- 1. finance.<t> views filter with "= any(array(...))" so Postgres can use company_id indexes
--    (the old "in (select ...)" form forced a hash join over every company's rows).
-- 2. Ledger index by company + period, covering what balance queries read.
-- 3. bal_asof gets a range condition on period (the left(period,4) test cannot use an index).
-- 4. Finance report functions get 32MB sort memory (sorts were spilling to disk).
-- Tested on live in a rolled-back transaction as FJ: forecast 8.9s -> 2.8s, flags 4.2s -> 1.0s, KPIs 2.2s -> 1.0s.

create index if not exists gl_trans_cid_period
  on finance_data.gl_trans (company_id, period) include (company, account, amount, docdate);

create or replace function public.sync_finance_views()
returns integer language plpgsql security definer set search_path = public as $$
declare t text; n int := 0;
begin
  for t in select c.relname from pg_class c
           where c.relnamespace = 'finance_data'::regnamespace and c.relkind = 'r' and c.relname not like '%\_\_stg' loop
    -- No drop-cascade fallback: a failure here should stop, not silently drop the report views.
    execute format('create or replace view finance.%I as select * from finance_data.%I
                    where company_id = any (array(select public.scope_companies()))', t, t);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function finance.bal_asof(p_as_at date)
returns table(account text, amount numeric) language sql stable as $$
  select t.account, sum(t.amount)
  from finance.gl_trans t
  where t.company = '01'
    and t.period >= finance.fy_of(p_as_at)::text || '00'
    and left(t.period, 4) = finance.fy_of(p_as_at)::text
    and t.period <= finance.period_of(p_as_at)
    and (right(t.period, 2) = '00' or t.docdate <= p_as_at)
  group by t.account
$$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname like 'fin\_%'
             and p.proname not in ('fin_stage_reset', 'fin_stage_load', 'fin_stage_commit', 'fin_whitelist') loop
    execute format('alter function %s set work_mem = %L', r.sig, '32MB');
  end loop;
end $$;

analyze finance_data.gl_trans;

select public.apply_company_scope();

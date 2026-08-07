-- Customer Insights: financial RPC family (revenue/GP/jobs/lanes, customer-centric).
-- APPLIED LIVE 7 Aug 2026 (migration report_customer_insights_financial_family). This file = repo parity.
-- Mirrors report_expsea_* patterns: SECURITY INVOKER plpgsql, staff-gated via is_staff(),
-- dynamic WHERE (no null-OR), revenue/GP from reporting.mv_job_financials joined by job_unique.
-- Mode filter = p_direction ('import'/'export'/null) + p_mode ('air'/'sea'/null).

create or replace function public.report_cust_list(
  p_from date, p_to date, p_direction text default null, p_mode text default null
) returns table(customer_account_id text, customer_name text, jobs bigint,
                revenue numeric, gross_profit numeric, open_balance numeric)
language plpgsql stable as $function$
declare filt text := '';
begin
  if not public.is_staff() then return; end if;
  if p_direction is not null then filt := filt || ' and s.direction = $3'; end if;
  if p_mode      is not null then filt := filt || ' and s.mode = $4'; end if;
  return query execute format($q$
    with base as (
      select distinct s.job_unique, s.customer_account_id
      from public.shipments s
      where s.customer_account_id is not null
        and coalesce(s.doc_date, s.etd) between $1 and $2 %s
    ),
    fin as (
      select b.customer_account_id,
             count(distinct b.job_unique) as jobs,
             coalesce(sum(jf.revenue),0)  as revenue,
             coalesce(sum(jf.gross_profit),0) as gp
      from base b
      left join reporting.mv_job_financials jf on jf.job_unique = b.job_unique
      group by b.customer_account_id
    ),
    ar as (
      select i.account_id, sum(i.balance) as open_balance
      from public.invoices i where i.balance > 0.01 group by i.account_id
    )
    select f.customer_account_id, c.name, f.jobs, f.revenue, f.gp, coalesce(a.open_balance,0)
    from fin f
    left join public.customers c on c.account_id = f.customer_account_id
    left join ar a on a.account_id = f.customer_account_id
    order by f.revenue desc
  $q$, filt) using p_from, p_to, p_direction, p_mode;
end;
$function$;

create or replace function public.report_cust_trend(
  p_from date, p_to date, p_account text default null,
  p_direction text default null, p_mode text default null
) returns table(month date, jobs bigint, revenue numeric, gross_profit numeric)
language plpgsql stable as $function$
declare filt text := '';
begin
  if not public.is_staff() then return; end if;
  if p_account   is not null then filt := filt || ' and s.customer_account_id = $3'; end if;
  if p_direction is not null then filt := filt || ' and s.direction = $4'; end if;
  if p_mode      is not null then filt := filt || ' and s.mode = $5'; end if;
  return query execute format($q$
    with base as (
      select distinct s.job_unique, date_trunc('month', coalesce(s.doc_date, s.etd))::date as month
      from public.shipments s
      where coalesce(s.doc_date, s.etd) between $1 and $2 %s
    )
    select b.month, count(distinct b.job_unique) as jobs,
           coalesce(sum(jf.revenue),0) as revenue, coalesce(sum(jf.gross_profit),0) as gp
    from base b left join reporting.mv_job_financials jf on jf.job_unique = b.job_unique
    group by b.month order by b.month
  $q$, filt) using p_from, p_to, p_account, p_direction, p_mode;
end;
$function$;

create or replace function public.report_cust_summary(
  p_from date, p_to date, p_account text default null,
  p_direction text default null, p_mode text default null
) returns table(revenue numeric, gross_profit numeric, jobs bigint,
                prev_revenue numeric, prev_gross_profit numeric, prev_jobs bigint)
language plpgsql stable as $function$
declare
  filt text := '';
  pf date := p_from - (p_to - p_from) - 1;   -- previous window, same length, immediately before
  pt date := p_from - 1;
begin
  if not public.is_staff() then return; end if;
  if p_account   is not null then filt := filt || ' and s.customer_account_id = $3'; end if;
  if p_direction is not null then filt := filt || ' and s.direction = $4'; end if;
  if p_mode      is not null then filt := filt || ' and s.mode = $5'; end if;
  return query execute format($q$
    with cur as (
      select distinct s.job_unique from public.shipments s
      where coalesce(s.doc_date, s.etd) between $1 and $2 %1$s
    ),
    prv as (
      select distinct s.job_unique from public.shipments s
      where coalesce(s.doc_date, s.etd) between $6 and $7 %1$s
    )
    select
      (select coalesce(sum(jf.revenue),0)      from cur x left join reporting.mv_job_financials jf on jf.job_unique=x.job_unique),
      (select coalesce(sum(jf.gross_profit),0) from cur x left join reporting.mv_job_financials jf on jf.job_unique=x.job_unique),
      (select count(*) from cur),
      (select coalesce(sum(jf.revenue),0)      from prv x left join reporting.mv_job_financials jf on jf.job_unique=x.job_unique),
      (select coalesce(sum(jf.gross_profit),0) from prv x left join reporting.mv_job_financials jf on jf.job_unique=x.job_unique),
      (select count(*) from prv)
  $q$, filt) using p_from, p_to, p_account, p_direction, p_mode, pf, pt;
end;
$function$;

create or replace function public.report_cust_lanes(
  p_from date, p_to date, p_account text default null,
  p_direction text default null, p_mode text default null, p_limit int default 200
) returns table(origin text, destination text, direction text, mode text,
                jobs bigint, revenue numeric, gross_profit numeric)
language plpgsql stable as $function$
declare filt text := '';
begin
  if not public.is_staff() then return; end if;
  if p_account   is not null then filt := filt || ' and s.customer_account_id = $3'; end if;
  if p_direction is not null then filt := filt || ' and s.direction = $4'; end if;
  if p_mode      is not null then filt := filt || ' and s.mode = $5'; end if;
  return query execute format($q$
    with base as (
      select distinct s.job_unique, s.origin, s.destination, s.direction, s.mode
      from public.shipments s
      where s.origin is not null and s.destination is not null
        and coalesce(s.doc_date, s.etd) between $1 and $2 %s
    )
    select b.origin, b.destination, b.direction, b.mode,
           count(distinct b.job_unique) as jobs,
           coalesce(sum(jf.revenue),0) as revenue, coalesce(sum(jf.gross_profit),0) as gp
    from base b left join reporting.mv_job_financials jf on jf.job_unique = b.job_unique
    group by b.origin, b.destination, b.direction, b.mode
    order by revenue desc
    limit $6
  $q$, filt) using p_from, p_to, p_account, p_direction, p_mode, p_limit;
end;
$function$;

grant execute on function public.report_cust_list(date,date,text,text)          to authenticated;
grant execute on function public.report_cust_trend(date,date,text,text,text)     to authenticated;
grant execute on function public.report_cust_summary(date,date,text,text,text)   to authenticated;
grant execute on function public.report_cust_lanes(date,date,text,text,text,int) to authenticated;

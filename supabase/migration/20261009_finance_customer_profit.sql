-- Customer profitability (Finance > Customer profit). Already applied to cpnkudbdzgnzmodhsrbf via MCP
-- (migration finance_customer_profit_mv). DO NOT RE-RUN; kept for repo parity.

create materialized view if not exists reporting.mv_customer_job_month as
select c.bill_to, c.job_unique, date_trunc('month', c.charge_date)::date as month,
  sum(coalesce(c.sell, 0)) sell, sum(coalesce(c.profit, 0)) profit
from public.job_charges c
where c.charge_date is not null and c.inv_type in ('FRT', 'FIN') and c.bill_to is not null
  and not exists (select 1 from public.charge_passthrough p where p.charge_code = c.charge_code)
  and abs(coalesce(c.sell, 0)) < 10000000 and abs(coalesce(c.profit, 0)) < 10000000
group by 1, 2, 3;
create unique index if not exists mv_customer_job_month_uq on reporting.mv_customer_job_month (bill_to, job_unique, month);
create index if not exists mv_customer_job_month_m on reporting.mv_customer_job_month (month);
revoke all on reporting.mv_customer_job_month from public, anon, authenticated;
-- refreshed hourly by cron job 8 alongside mv_job_financials
select cron.alter_job(8, command := 'refresh materialized view concurrently public.mv_consol_teu; refresh materialized view concurrently reporting.mv_job_financials; refresh materialized view concurrently reporting.mv_customer_job_month;');

create or replace function public.fin_customer_profit(p_from date, p_to date, p_rate numeric default 0.09)
returns table (accountid text, name text, sales_rep text, terms text, is_related boolean,
  jobs int, revenue numeric, gp numeric, margin numeric, gp_per_job numeric,
  prev_revenue numeric, prev_gp numeric, billed numeric, disb_billed numeric,
  avg_days_to_pay numeric, ar_balance numeric, overdue_60 numeric,
  serve_cost numeric, finance_cost numeric, net_contribution numeric, cost_per_job numeric, verdict text)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
declare
  v_prev_from date := p_from - (p_to - p_from + 1);
  v_opex numeric;
begin
  perform finance.assert_access();

  -- company overheads in the window (GL), spread per job billed
  select coalesce(sum(t.amount), 0) into v_opex
  from finance.gl_trans t join finance.v_accounts v on v.account = t.account
  where t.company = '01' and v.pl_group = 'Operating expenses' and right(t.period, 2) <> '00'
    and t.period between finance.period_of(p_from) and finance.period_of(p_to);

  return query
  with jc as (
    select m.bill_to, m.job_unique, m.month, m.sell, m.profit
    from reporting.mv_customer_job_month m
    where m.month between date_trunc('month', v_prev_from)::date and p_to
  ), cur as (
    select bill_to a, count(distinct job_unique) filter (where sell <> 0)::int jobs, sum(sell) rev, sum(profit) gp
    from jc where month >= date_trunc('month', p_from)::date group by 1
  ), prev as (
    select bill_to a, sum(sell) rev, sum(profit) gp from jc where month < date_trunc('month', p_from)::date group by 1
  ), tot as (
    select sum(jobs) j, sum(gp) g, sum(rev) r from cur
  ), led as (
    select i.accountid a,
      sum(i.amt_local) filter (where i.doc_date between p_from and p_to) billed,
      sum(i.amt_local) filter (where i.doc_date between p_from and p_to and i.doctype = 'DIS') disb,
      sum(i.balance) filter (where abs(coalesce(i.balance, 0)) >= 0.01) bal,
      sum(i.balance) filter (where abs(coalesce(i.balance, 0)) >= 0.01 and current_date - coalesce(i.datedue, i.doc_date) > 60) od60
    from finance.ledger_invoices i where i.company = '01' and i.d_c_flag = 'D' group by 1
  ), pay as (
    select a.accountid a, sum(a.amount * (a.date1::date - i.doc_date)) / nullif(sum(a.amount), 0) dtp
    from finance.allocations a
    join finance.ledger_invoices i on i.company = a.company and i.d_c_flag = a.d_c_flag and i.number = a.invoice and i.accountid = a.accountid
    where a.company = '01' and a.d_c_flag = 'D' and a.amount > 0 and a.date1 >= current_date - 365
    group by 1
  ), x as (
    select c.a, c.jobs, c.rev, c.gp, p.rev prev_rev, p.gp prev_gp, l.billed, l.disb, l.bal, l.od60, py.dtp,
      (select v_opex / nullif(j, 0) from tot) cpj,
      (select g / nullif(r, 0) from tot) cm
    from cur c left join prev p on p.a = c.a left join led l on l.a = c.a left join pay py on py.a = c.a
    where coalesce(c.rev, 0) <> 0 or coalesce(c.gp, 0) <> 0
  )
  select x.a, coalesce(pa.name, cu.name), coalesce(cu.sales_manager, pa.salesarea),
    coalesce(pa.term_f, pa.payment_term),
    x.a in ('3RN', 'NRR', 'UBNAN', 'UBFSYD'),
    x.jobs, round(x.rev, 2), round(x.gp, 2),
    round(x.gp / nullif(x.rev, 0) * 100, 1), round(x.gp / nullif(x.jobs, 0), 2),
    round(coalesce(x.prev_rev, 0), 2), round(coalesce(x.prev_gp, 0), 2),
    round(coalesce(x.billed, 0), 2), round(coalesce(x.disb, 0), 2),
    round(x.dtp, 1), round(coalesce(x.bal, 0), 2), round(coalesce(x.od60, 0), 2),
    round(x.jobs * x.cpj, 2),
    round(coalesce(x.billed, x.rev, 0) * greatest(coalesce(x.dtp, 30), 0) / 365.0 * p_rate, 2),
    round(x.gp - x.jobs * x.cpj - coalesce(x.billed, x.rev, 0) * greatest(coalesce(x.dtp, 30), 0) / 365.0 * p_rate, 2),
    round(x.cpj, 2),
    case
      when x.gp - x.jobs * x.cpj < 0 and x.gp / nullif(x.rev, 0) < x.cm then 'reprice'
      when coalesce(x.od60, 0) > 0.25 * greatest(coalesce(x.bal, 0), 1) or coalesce(x.dtp, 0) > 60 then 'tighten terms'
      when x.gp - x.jobs * x.cpj < 0 then 'too small to serve'
      when x.gp / nullif(x.rev, 0) >= x.cm and coalesce(x.dtp, 0) <= 45 then 'grow'
      else 'keep'
    end
  from x
  left join finance.parties pa on pa.accountid = x.a
  left join public.customers cu on cu.account_id = x.a;
end $$;

revoke all on function public.fin_customer_profit(date, date, numeric) from public, anon;
grant execute on function public.fin_customer_profit(date, date, numeric) to authenticated;
notify pgrst, 'reload schema';

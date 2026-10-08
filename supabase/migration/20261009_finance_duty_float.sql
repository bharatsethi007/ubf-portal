-- Customs duty float (Finance > Customs duty) + 13-week forecast pays Customs on the 20th.
-- Already applied to cpnkudbdzgnzmodhsrbf via MCP (finance_duty_float_v1..v3, finance_forecast_customs_due). DO NOT RE-RUN; repo parity only.

-- Customs duty float: duty and GST UBF pays NZ Customs (creditor NZCUST) for clients, how it is recovered
-- (pass-through charge codes on the job, usually a DIS invoice) and how long UBF funds it between paying
-- Customs and the client paying UBF. Idempotent.

create or replace function public.fin_duty_float(p_from date default (current_date - 365), p_to date default current_date, p_rate numeric default 0.09)
returns jsonb
language plpgsql stable security definer set search_path = finance, public as $$
declare v jsonb;
begin
  perform finance.assert_access();
  with nz as (  -- every NZCUST invoice tied to a job, with the date UBF paid it
    select i.job_no, i.number, i.doc_date, i.amt_local amt, i.balance,
      -- Customs deferred payment: entries in a month are due on the 20th of the next month
      (date_trunc('month', i.doc_date) + interval '1 month 19 days')::date customs_due,
      (select max(a.date1)::date from finance.allocations a
        where a.company = '01' and a.d_c_flag = 'C' and a.accountid = 'NZCUST' and a.invoice = i.number) paid_on
    from finance.ledger_invoices i
    where i.company = '01' and i.d_c_flag = 'C' and i.accountid = 'NZCUST' and i.job_no is not null
  ), nj as (
    select job_no, sum(amt) duty, min(doc_date) duty_date, sum(balance) customs_open, min(customs_due) customs_due, count(*) > count(distinct round(amt, 2)) dup,
      case when bool_and(abs(coalesce(balance, 0)) < 0.01) then max(paid_on) end customs_paid
    from nz group by 1
  ), ci as (  -- customer invoices on those jobs; DIS invoices carry the duty when they exist
    select i.job_no, i.accountid, i.number, i.doctype, i.doc_date, i.amt_local amt, i.balance,
      bool_or(i.doctype = 'DIS') over (partition by i.job_no) has_dis,
      (select max(a.date1)::date from finance.allocations a
        where a.company = '01' and a.d_c_flag = 'D' and a.accountid = i.accountid and a.invoice = i.number) paid_on
    from finance.ledger_invoices i
    where i.company = '01' and i.d_c_flag = 'D' and i.job_no in (select job_no from nj)
  ), cj as (
    select job_no, max(accountid) cust, sum(amt) billed, sum(balance) as open, min(doc_date) inv_date, bool_or(has_dis) has_dis,
      case when bool_and(abs(coalesce(balance, 0)) < 0.01) then max(paid_on) end cust_paid
    from ci where doctype = 'DIS' or not has_dis group by 1
  ), pc as (
    select c.job_unique job_no, sum(c.sell) rec
    from public.job_charges c join public.charge_passthrough p on p.charge_code = c.charge_code
    where c.job_unique in (select job_no from nj) group by 1
  ), j as (
    select nj.*, cj.cust, cj.billed, coalesce(cj.open, 0) cust_open, cj.inv_date, cj.cust_paid,
      greatest(coalesce(pc.rec, 0), case when cj.has_dis then cj.billed else 0 end) rec,
      case when cj.cust_paid is null then 0
           else greatest(0, coalesce(nj.customs_paid, current_date) - cj.cust_paid) end hdays,
      case when nj.customs_paid is null then 0
           else greatest(0, coalesce(cj.cust_paid, current_date) - nj.customs_paid) end fdays
    from nj left join cj using (job_no) left join pc using (job_no)
  ), w as (select * from j where duty_date between p_from and p_to),
  nd as (select min(customs_due) d from j where customs_paid is null and customs_due >= current_date)
  select jsonb_build_object(
    'now', (select jsonb_build_object(
        'customs_open', round(sum(customs_open), 2),
        'customs_overdue', round(sum(customs_open) filter (where customs_paid is null and customs_due < current_date and duty_date >= current_date - 120), 2),
        'customs_stale', round(sum(customs_open) filter (where customs_paid is null and duty_date < current_date - 120), 2),
        'customs_stale_jobs', count(*) filter (where customs_paid is null and abs(customs_open) >= 0.01 and duty_date < current_date - 120),
        'next_due_date', (select d from nd),
        'next_due_amount', round(sum(customs_open) filter (where customs_paid is null and customs_due = (select d from nd)), 2),
        'clients_owe', round(sum(least(cust_open, duty)) filter (where cust_open > 0.01), 2),
        'funded_now', round(sum(least(cust_open, duty)) filter (where cust_open > 0.01 and customs_paid is not null), 2),
        'funded_now_jobs', count(*) filter (where cust_open > 0.01 and customs_paid is not null)) from j),
    'totals', (select jsonb_build_object(
        'jobs', count(*), 'duty', round(sum(duty), 2), 'recovered', round(sum(rec), 2),
        'paid_before_customs', round(100.0 * count(*) filter (where cust_paid is not null and customs_paid is not null and cust_paid <= customs_paid) / nullif(count(*) filter (where customs_paid is not null), 0), 1),
        'avg_fdays', round(sum(duty * fdays) / nullif(sum(duty) filter (where customs_paid is not null), 0), 1),
        'funding_cost', round(sum(duty * fdays / 365.0 * p_rate), 2),
        'avg_funded', round(sum(duty * fdays) / greatest(1, p_to - p_from + 1), 2),
        'avg_held', round(sum(duty * hdays) / greatest(1, p_to - p_from + 1), 2),
        'avg_hdays', round(sum(duty * hdays) / nullif(sum(duty) filter (where cust_paid is not null), 0), 1),
        'held_benefit', round(sum(duty * hdays / 365.0 * p_rate), 2)) from w),
    'months', (select coalesce(jsonb_agg(m order by m.month), '[]') from (
        select date_trunc('month', duty_date)::date as month, round(sum(duty), 2) duty, round(sum(rec), 2) recovered,
          round(sum(duty * fdays) / nullif(sum(duty) filter (where customs_paid is not null), 0), 1) avg_fdays,
          round(sum(duty * hdays) / nullif(sum(duty) filter (where cust_paid is not null), 0), 1) avg_hdays, count(*) jobs
        from w group by 1) m),
    'customers', (select coalesce(jsonb_agg(c order by c.funding_cost desc, c.duty desc), '[]') from (
        select w.cust accountid, coalesce(pa.name, cu.name) name, count(*) jobs, round(sum(duty), 2) duty, round(sum(rec), 2) recovered,
          round(sum(duty * fdays) / nullif(sum(duty) filter (where customs_paid is not null), 0), 1) avg_fdays,
          round(sum(duty * hdays) / nullif(sum(duty) filter (where cust_paid is not null), 0), 1) avg_hdays,
          round(avg(cust_paid - inv_date) filter (where cust_paid is not null), 1) days_to_pay,
          round(100.0 * count(*) filter (where cust_paid is not null and customs_paid is not null and cust_paid <= customs_paid) / nullif(count(*) filter (where customs_paid is not null), 0), 0) pct_before,
          round(sum(duty * fdays / 365.0 * p_rate), 2) funding_cost,
          round(sum(least(cust_open, duty)) filter (where cust_open > 0.01), 2) owe_now,
          round(sum(least(cust_open, duty)) filter (where cust_open > 0.01 and customs_paid is not null), 2) funded_now
        from w left join finance.parties pa on pa.accountid = w.cust left join public.customers cu on cu.account_id = w.cust
        where w.cust is not null group by 1, 2) c),
    'unrecovered', (select coalesce(jsonb_agg(u order by u.gap desc), '[]') from (
        select w.job_no, s.module, s.house_bill, w.cust accountid, coalesce(pa.name, cu.name, s.customer_account_id) name, w.duty_date,
          round(w.duty, 2) duty, round(w.rec, 2) recovered, round(w.duty - w.rec, 2) gap, round(coalesce(w.billed, 0), 2) billed,
          case when w.dup then 'duplicate' when coalesce(w.billed, 0) = 0 then 'not_billed' else 'short' end reason
        from w left join public.shipments s on s.job_unique = w.job_no
        left join finance.parties pa on pa.accountid = w.cust left join public.customers cu on cu.account_id = w.cust
        where w.duty - w.rec > greatest(50, 0.1 * w.duty) and w.duty_date < current_date - 7) u)
  ) into v;
  return v;
end $$;

revoke all on function public.fin_duty_float(date, date, numeric) from public, anon;
grant execute on function public.fin_duty_float(date, date, numeric) to authenticated;
notify pgrst, 'reload schema';

-- 13-week forecast: Customs (party_class 'customs') invoices fall due on the 20th of the following month.
do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.fin_cash_forecast(int)'::regprocedure);
  if position('end as exp_date' in d) > 0 then return; end if;
  n := replace(d, 'greatest(v_start, coalesce(i.datedue, i.doc_date)',
    'case when i.d_c_flag = ''C'' and i.accountid in (select pc.accountid from finance.party_class pc where pc.class = ''customs'')'
    || ' then greatest(v_start, (date_trunc(''month'', i.doc_date) + interval ''1 month 19 days'')::date)'
    || ' else greatest(v_start, coalesce(i.datedue, i.doc_date)');
  n := replace(n, ')::int) as exp_date,', ')::int) end as exp_date,');
  execute n;
end $mig$;

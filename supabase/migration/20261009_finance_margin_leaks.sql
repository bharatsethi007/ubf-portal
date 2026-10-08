-- REPO PARITY ONLY. Applied to Supabase via MCP on 2026-10-09. DO NOT RE-RUN.
-- Margin leak finder (Reports > Finance > Margin leaks).

-- Margin leak finder: per-job supplier cost billed vs cost booked at customer invoicing.
-- Accruals 23000 per job: credits (PROF / INV_D) = cost booked when the customer was invoiced,
-- debits (INV_C less CNE_C) = what suppliers actually billed. Idempotent.

create table if not exists finance.leak_reviews (
  job_no bigint not null, category text not null,
  status text not null check (status in ('rebilled', 'accepted', 'fixed', 'ignore')),
  note text, gap_at_review numeric,
  reviewed_by uuid default auth.uid(), reviewed_at timestamptz default now(),
  primary key (job_no, category));
revoke all on all tables in schema finance from public, anon, authenticated;

create or replace function public.fin_margin_leaks(p_from date default date '2025-04-01')
returns table (job_no bigint, category text, module text, house_bill text, ref_job text, customer_id text,
  customer text, suppliers text, cost_billed numeric, cost_booked numeric, gap numeric, revenue numeric,
  gp numeric, margin numeric, first_bill date, last_bill date, last_invoice date, days_since numeric,
  review_status text, review_note text)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  with acc as (
    select t.job_no j,
      sum(t.amount) filter (where t.doctype in ('INV_C', 'CNE_C')) billed,
      -sum(t.amount) filter (where t.doctype not in ('INV_C', 'CNE_C')) booked,
      min(t.docdate) filter (where t.doctype = 'INV_C') fb,
      max(t.docdate) filter (where t.doctype = 'INV_C') lb,
      min(t.docdate) fa
    from finance.gl_trans t
    where t.company = '01' and t.account = '23000-00' and t.job_no is not null and t.docdate >= p_from
    group by t.job_no
  ), sup as (  -- supplier codes from the creditor line of each supplier-invoice batch
    select t.job_no j, string_agg(distinct substring(c.comment from 'Creditor [Aa]ccount:? *([^ ,]+)'), ', ') sup
    from finance.gl_trans t
    join finance.gl_trans c on c.company = t.company and c.batchno = t.batchno and c.account = '21200-00'
    where t.company = '01' and t.account = '23000-00' and t.doctype = 'INV_C' and t.job_no is not null and t.docdate >= p_from
    group by t.job_no
  ), rev as (
    select i.job_no j, sum(coalesce(i.amt_local, 0) - coalesce(i.tax_amount, 0)) r, max(i.doc_date) li,
      max(i.accountid) cust
    from finance.ledger_invoices i
    where i.company = '01' and i.d_c_flag = 'D' and i.job_no is not null
    group by i.job_no
  ), base as (
    select a.j, coalesce(a.billed, 0) billed, coalesce(a.booked, 0) booked,
      coalesce(a.billed, 0) - coalesce(a.booked, 0) gap, coalesce(r.r, 0) rv, r.li, r.cust, a.fb, a.lb, su.sup,
      r.j is not null as invoiced, coalesce(sh.relevant_date::date, sh.etd::date, a.fa) as jdate
    from acc a left join rev r on r.j = a.j left join sup su on su.j = a.j
    left join public.shipments sh on sh.job_unique = a.j
  ), cat as (
    select b.*,
      case
        when not b.invoiced and b.booked <= 0.01 and b.billed > 50 and b.fb < current_date - 14 and b.jdate >= p_from + 30 then 'not_invoiced'
        when b.invoiced and b.booked > 0 and b.gap > greatest(50, 0.05 * b.booked) and b.li < current_date - 21 then 'overrun'
        when b.invoiced and b.rv > 0 and b.rv - greatest(b.booked, b.billed) < -50 and b.li < current_date - 21 then 'loss'
        when b.invoiced and b.booked = 0 and b.billed > 50 and b.li < current_date - 30 then 'never_costed'
        when b.gap < -50 and greatest(coalesce(b.lb, b.li), b.li) < current_date - 60 then 'cost_not_billed'
      end as c
    from base b
  )
  select c.j, c.c, s.module, s.house_bill, s.job_no::text, coalesce(c.cust, s.customer_account_id),
    coalesce(p.name, cu.name), c.sup,
    round(c.billed, 2), round(c.booked, 2), round(c.gap, 2), round(c.rv, 2),
    round(c.rv - greatest(c.booked, c.billed), 2),
    case when c.rv > 0 then round((c.rv - greatest(c.booked, c.billed)) / c.rv * 100, 1) end,
    c.fb, c.lb, c.li,
    (current_date - coalesce(c.lb, c.li))::numeric,
    lr.status, lr.note
  from cat c
  left join public.shipments s on s.job_unique = c.j
  left join finance.parties p on p.accountid = coalesce(c.cust, s.customer_account_id)
  left join public.customers cu on cu.account_id = coalesce(c.cust, s.customer_account_id)
  left join finance.leak_reviews lr on lr.job_no = c.j and lr.category = c.c
    and abs(coalesce(lr.gap_at_review, 0) - round(c.gap, 2)) < 1
  where c.c is not null;
end $$;

create or replace function public.fin_leak_review(p_job_no bigint, p_category text, p_status text,
  p_gap numeric, p_note text default null)
returns void
language plpgsql security definer set search_path = finance, public as $$
begin
  perform finance.assert_access();
  if p_status = 'clear' then
    update finance.leak_reviews set gap_at_review = -999999999 where job_no = p_job_no and category = p_category;
    return;
  end if;
  if p_status not in ('rebilled', 'accepted', 'fixed', 'ignore') then raise exception 'bad status'; end if;
  insert into finance.leak_reviews (job_no, category, status, note, gap_at_review, reviewed_by)
  values (p_job_no, p_category, p_status, nullif(trim(p_note), ''), round(p_gap, 2), auth.uid())
  on conflict (job_no, category) do update set status = excluded.status, note = excluded.note,
    gap_at_review = excluded.gap_at_review, reviewed_by = excluded.reviewed_by, reviewed_at = now();
end $$;

revoke all on function public.fin_margin_leaks(date) from public, anon;
revoke all on function public.fin_leak_review(bigint, text, text, numeric, text) from public, anon;
grant execute on function public.fin_margin_leaks(date) to authenticated;
grant execute on function public.fin_leak_review(bigint, text, text, numeric, text) to authenticated;

notify pgrst, 'reload schema';

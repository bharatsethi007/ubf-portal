-- Customer Insights: AR RPC family + perf indexes. APPLIED LIVE 7 Aug 2026
-- (migrations report_customer_insights_ar_family + shipments_relevantdate_expr_index). Repo parity.
-- Point-in-time AR; portfolio-wide when p_account is null. Staff-gated.
-- Aging on invoices.balance vs date_due; DSO = open balance / (trailing-365d billings / 365).
-- No paid-date exists in the DB, so DSO + weighted days-overdue are the "time to pay" proxy.

create or replace function public.report_cust_ar(p_account text default null)
returns table(
  open_balance numeric, not_due numeric, d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric,
  open_count bigint, oldest_overdue_days int, avg_overdue_days numeric, dso_days numeric, billed_12mo numeric,
  credit_limit numeric, payment_alert boolean, import_cod boolean, account_terms text
)
language plpgsql stable as $function$
declare filt text := '';
begin
  if not public.is_staff() then return; end if;
  if p_account is not null then filt := ' and i.account_id = $1'; end if;
  return query execute format($q$
    with o as (
      select i.balance, (current_date - i.date_due) as od
      from public.invoices i where i.balance > 0.01 %1$s
    ),
    b as (
      select coalesce(sum(i.amt_local),0) as billed
      from public.invoices i
      where i.doc_date >= current_date - 365 %1$s
    ),
    cust as (
      select c.credit_limit, c.payment_alert, c.import_cod, c.account_terms
      from public.customers c where $1 is not null and c.account_id = $1
    )
    select
      coalesce(sum(o.balance),0),
      coalesce(sum(o.balance) filter (where o.od <= 0),0),
      coalesce(sum(o.balance) filter (where o.od between 1 and 30),0),
      coalesce(sum(o.balance) filter (where o.od between 31 and 60),0),
      coalesce(sum(o.balance) filter (where o.od between 61 and 90),0),
      coalesce(sum(o.balance) filter (where o.od > 90),0),
      count(*)::bigint,
      coalesce(max(o.od) filter (where o.od > 0),0)::int,
      case when coalesce(sum(o.balance) filter (where o.od>0),0) > 0
           then round(sum(o.balance*o.od) filter (where o.od>0) / sum(o.balance) filter (where o.od>0), 1)
           else 0 end,
      case when (select billed from b) > 0
           then round((select coalesce(sum(o2.balance),0) from o o2) / ((select billed from b)/365.0), 1)
           else null end,
      (select billed from b),
      (select credit_limit from cust), (select payment_alert from cust),
      (select import_cod from cust), (select account_terms from cust)
    from o
  $q$, filt) using p_account;
end;
$function$;

create or replace function public.report_cust_open_invoices(p_account text default null, p_limit int default 100)
returns table(invoice_no text, doctype text, account_id text, customer_name text,
              doc_date date, date_due date, days_overdue int, balance numeric)
language plpgsql stable as $function$
declare filt text := '';
begin
  if not public.is_staff() then return; end if;
  if p_account is not null then filt := ' and i.account_id = $1'; end if;
  return query execute format($q$
    select i.invoice_no, i.doctype, i.account_id, c.name,
           i.doc_date, i.date_due, (current_date - i.date_due)::int as days_overdue, i.balance
    from public.invoices i
    left join public.customers c on c.account_id = i.account_id
    where i.balance > 0.01 %1$s
    order by (current_date - i.date_due) desc, i.balance desc
    limit $2
  $q$, filt) using p_account, p_limit;
end;
$function$;

grant execute on function public.report_cust_ar(text)                to authenticated;
grant execute on function public.report_cust_open_invoices(text,int) to authenticated;

-- Perf: covering indexes for the base predicate (All-modes portfolio + single-account drill-down)
create index if not exists idx_shipments_relevantdate_expr
  on public.shipments ((coalesce(doc_date, etd)));
create index if not exists idx_shipments_custacct_relevantdate
  on public.shipments (customer_account_id, (coalesce(doc_date, etd)));

-- REPO PARITY ONLY. Applied to Supabase via MCP on 2026-10-09. DO NOT RE-RUN.
-- Finance module: finance schema mirror of TradeWindow GL/AR/AP/bank + report RPCs (Reports > Finance).
-- Loaded nightly by sync_finance.py (Customer Portal folder). Access: has_perm('finance','read').

create schema if not exists finance;
revoke all on schema finance from public, anon, authenticated;

create table if not exists finance.gl_accounts (
  id bigint primary key, company text, account text, acctname text, accountype text,
  totallev text, headlev text, link_to text, link_account text, status text, gst text,
  closed text, currency text, branch text, department text);
create table if not exists finance.gl_control (
  id bigint primary key, company text, debtors_acc text, creditor_acc text, pl_acc text,
  tax_account text, tax_account_i text, debtors_acc_rev text, creditor_acc_rev text,
  inv_arrural_account text, sales_account text, cost_account text, gl_period text);
create table if not exists finance.gl_trans (
  id bigint primary key, company text, branch text, department text, comment text, doctype text,
  amount numeric, amount_f numeric, exchange_r numeric, curr_type text, docdate date,
  batchno bigint, period text, date1 timestamp, operator text, docno text, account text,
  job_no bigint, category text, line integer, category_1 text, category_3 text, division text);
create index if not exists gl_trans_acct_date on finance.gl_trans (company, account, docdate);
create index if not exists gl_trans_batch on finance.gl_trans (company, batchno);
create index if not exists gl_trans_period on finance.gl_trans (period);
create table if not exists finance.gl_opening (
  company text not null, account text not null, branch text not null, department text not null,
  amount numeric, as_at date, primary key (company, account, branch, department));
create table if not exists finance.gl_batches (
  id bigint primary key, company text, batchno bigint, date1 timestamp, journal text,
  balance numeric, comments text, hold text, posted text, period text, cheque text);
create index if not exists gl_batches_no on finance.gl_batches (company, batchno);
create table if not exists finance.bank_accounts (
  id bigint primary key, company text, number text, currency text, name text, bank text,
  account_name text, stmt_no text, stmt_date date, stmt_bal numeric, gl_account text,
  gl_curr_adj text, gl_overpay text, gl_charge_account text, date1 timestamp);
create table if not exists finance.cashbook (
  id bigint primary key, company text, book_no text, doc_type text, transact text,
  amount numeric, amount_local numeric, cleared text, cleared_date date, cleared_by text,
  comments text, account text, source text, details text, date1 date, operator text);
create index if not exists cashbook_book_date on finance.cashbook (company, book_no, date1);
create table if not exists finance.cashbook_statements (
  id bigint primary key, company text, book_no text, amount_o numeric, amount_d numeric,
  amount_c numeric, statement_no text, cleared_date date, statement_date date,
  created_date timestamp, cleared_by text);
create table if not exists finance.ledger_invoices (
  id bigint primary key, company text, branch text, accountid text, d_c_flag text, number text,
  cashbook text, doctype text, doc_date date, datedue date, account_date date, module text,
  job_no bigint, text_ref text, amt_local numeric, amt_foreig numeric, curr_name text,
  exch_rate numeric, balance numeric, balancef numeric, bal_foreig numeric, tax_amount numeric,
  period text, gl_post bigint, comment text, approve text, contra_flag text, wh_amount numeric,
  voucher text, operator text, date1 timestamp);
create index if not exists ledger_inv_acct on finance.ledger_invoices (d_c_flag, accountid);
create index if not exists ledger_inv_date on finance.ledger_invoices (d_c_flag, doc_date);
create index if not exists ledger_inv_no on finance.ledger_invoices (company, d_c_flag, number);
create table if not exists finance.receipts (
  id bigint primary key, company text, cashbook text, receipt_no bigint, branch text,
  d_c_flag text, accountid text, r_cnote text, cheque text, amount numeric, currency text,
  amount_f numeric, balance numeric, exch_rate numeric, posted text, date1 date,
  date2 timestamp, period text, batch bigint, gl_post bigint, gst_amount numeric,
  reason_code text, reason text, wh_amount numeric, operator text, bank_branch text);
create index if not exists receipts_date on finance.receipts (d_c_flag, date1);
create index if not exists receipts_no on finance.receipts (company, d_c_flag, receipt_no);
create table if not exists finance.allocations (
  id bigint primary key, company text, receipt bigint, invoice text, accountid text,
  d_c_flag text, r_c_flag text, branch text, currency text, amount numeric, amount_f numeric,
  date1 timestamp, operator text);
create index if not exists alloc_inv on finance.allocations (company, d_c_flag, invoice);
create index if not exists alloc_rcpt on finance.allocations (company, d_c_flag, receipt);
create table if not exists finance.misc_payments (
  id bigint primary key, company text, branch text, department text, comment text,
  amount numeric, batchno bigint, date1 date, date2 timestamp, xno bigint, cheque text,
  gst_code text, gst_rate numeric, doctype text, bookno text, currency text,
  exch_rate numeric, misc_number bigint, account text, division text, operator text);
create table if not exists finance.charge_codes (
  id bigint primary key, charge_code text, description text, g_l_sales text, g_l_cost text,
  g_l_accrual text, charge_group text, usage_dept text, closed text,
  gst_code_sales text, gst_code_purchase text);
create table if not exists finance.parties (
  accountid text primary key, name text, debtor text, creditor text, closed text,
  salesarea text, branch text, business_country text, curr_type text, payment_term text,
  cred_lim numeric, debtor_cred_lim numeric, term_f text, term_d text, term_r text,
  creditor_term text, creditor_credterms numeric);
create table if not exists finance.fx_daily (
  currency text not null, date1 date not null, exch_rate numeric, primary key (currency, date1));
create table if not exists finance.sync_state (
  table_name text primary key, rows integer, from_date date, synced_at timestamptz default now());
do $$
declare t text;
begin
  foreach t in array array['gl_accounts','gl_control','gl_trans','gl_opening','gl_batches',
    'bank_accounts','cashbook','cashbook_statements','ledger_invoices','receipts',
    'allocations','misc_payments','charge_codes','parties','fx_daily'] loop
    execute format('create table if not exists finance.%I (like finance.%I)', t || '__stg', t);
  end loop;
end $$;
revoke all on all tables in schema finance from public, anon, authenticated;

create or replace function public.fin_whitelist(p_table text) returns boolean
language sql immutable as $$
  select p_table = any (array['gl_accounts','gl_control','gl_trans','gl_opening','gl_batches',
    'bank_accounts','cashbook','cashbook_statements','ledger_invoices','receipts',
    'allocations','misc_payments','charge_codes','parties','fx_daily'])
$$;
create or replace function public.fin_stage_load(p_table text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = finance, public as $$
declare n integer;
begin
  if not public.fin_whitelist(p_table) then raise exception 'bad table %', p_table; end if;
  execute format('insert into finance.%1$I select * from jsonb_populate_recordset(null::finance.%1$I, $1)',
                 p_table || '__stg') using p_rows;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.fin_stage_load(text, jsonb) from public, anon, authenticated;
grant execute on function public.fin_stage_load(text, jsonb) to service_role;
insert into public.app_modules (key, label, sort_order, is_active)
select 'finance', 'Finance', 95, true where not exists (select 1 from public.app_modules where key = 'finance');
insert into public.role_permissions (role_id, module_key, can_read, can_add, can_edit, can_delete)
select r.id, 'finance', true, false, false, false from public.roles r
where r.key in ('admin', 'finance')
  and not exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.module_key = 'finance');

-- Finance ingest: commit + reset functions (service_role only).
-- Paste into Supabase dashboard > SQL Editor > Run. Safe to re-run.

create or replace function public.fin_stage_reset(p_table text) returns void
language plpgsql security definer set search_path = finance, public as $$
begin
  if not public.fin_whitelist(p_table) then raise exception 'bad table %', p_table; end if;
  execute format('truncate finance.%I', p_table || '__stg');
end $$;

create or replace function public.fin_stage_commit(p_table text, p_from date) returns integer
language plpgsql security definer set search_path = finance, public as $$
declare n integer;
begin
  if not public.fin_whitelist(p_table) then raise exception 'bad table %', p_table; end if;
  execute format('truncate finance.%I', p_table);
  execute format('insert into finance.%I select * from finance.%I', p_table, p_table || '__stg');
  get diagnostics n = row_count;
  execute format('truncate finance.%I', p_table || '__stg');
  insert into finance.sync_state (table_name, rows, from_date, synced_at)
  values (p_table, n, p_from, now())
  on conflict (table_name) do update set rows = excluded.rows, from_date = excluded.from_date,
    synced_at = excluded.synced_at;
  return n;
end $$;

revoke all on function public.fin_stage_reset(text) from public, anon, authenticated;
revoke all on function public.fin_stage_commit(text, date) from public, anon, authenticated;
grant execute on function public.fin_stage_reset(text) to service_role;
grant execute on function public.fin_stage_commit(text, date) to service_role;

-- GL reload needs more than the 8s API default
alter role service_role set statement_timeout = '300s';

notify pgrst, 'reload schema';

-- Finance reporting model: FY/period helpers + account classification view.
-- Idempotent. NZ FY Apr-Mar. TradeWindow period YYYYPP: PP 00 = year-open balances, 01 = April.

create table if not exists finance.account_map_override (
  account text primary key, pl_group text, pl_line text, cf_section text, cf_line text,
  bs_group text, note text, updated_at timestamptz default now());

create or replace function finance.fy_of(d date) returns int
language sql immutable as $$
  select case when extract(month from d) >= 4 then extract(year from d)::int
              else extract(year from d)::int - 1 end
$$;

create or replace function finance.period_of(d date) returns text
language sql immutable as $$
  select finance.fy_of(d)::text || lpad(((extract(month from d)::int + 8) % 12 + 1)::text, 2, '0')
$$;

-- first day of the calendar month a period belongs to (PP 00 -> 31 Mar opening, mapped to March)
create or replace function finance.period_month(p text) returns date
language sql immutable as $$
  select case when right(p, 2) = '00' then make_date(left(p, 4)::int, 3, 1)
    else make_date(left(p, 4)::int + case when right(p, 2)::int >= 10 then 1 else 0 end,
                   ((right(p, 2)::int + 2) % 12) + 1, 1) end
$$;

create or replace view finance.v_accounts as
with a as (
  select g.account, g.acctname, g.accountype,
         nullif(regexp_replace(left(g.account, 5), '[^0-9]', '', 'g'), '')::int as n,
         g.account in (select b.gl_account from finance.bank_accounts b where b.gl_account is not null)
           or g.account in ('11100-00', '11160-00') as is_cash
  from finance.gl_accounts g
  where g.company = '01' and g.account is not null
), r as (
  select a.*,
    case
      when n in (41100,41110,41120,41125,51000,51010,51200,51210) then 'Export Air'
      when n in (41300,41310,51030,51035) then 'Export Sea'
      when n in (41200,51020) then 'Customs Clearance'
      when n in (41210,41220,51500) then 'Import Handling'
      when n in (41240,41245,41320,41330,51240,51245,51320,51330) then 'Import Freight'
      when n in (41230,42000,51040) then 'Cartage'
      when n in (41350,41355,44550,51350,51355,54550) then 'Warehouse & 3PL'
      when n in (41450,51450) then 'Cargo Insurance'
      when n in (44500,54500) then 'Fiji Transhipment'
      when n between 40000 and 59999 and accountype in ('R','X') then 'Other Services'
    end as service_line,
    case
      when accountype = 'R' and n between 40000 and 44699 and n not between 43000 and 43999 then 'Revenue'
      when accountype = 'X' and n between 50000 and 59999 then 'Cost of sales'
      when accountype = 'R' and n between 44700 and 49999 then 'Other operating income'
      when accountype = 'X' and n between 60000 and 69999 then 'Operating expenses'
      when accountype = 'R' and (n between 80000 and 89999 or n between 43000 and 43999) then 'Other income'
      when accountype = 'X' and n between 90000 and 91499 then 'Finance costs'
      when accountype = 'X' and n between 92000 and 92999 then 'Income tax'
      when accountype in ('R','X') then 'Operating expenses'
    end as pl_group,
    case
      when n in (62000,62010,62015,62020,62030,62035,62040,62045,62055,62060,61150,61080) then 'People'
      when n in (62300,62600,62605,62610,62620,62630,61800) then 'Premises'
      when n in (61220,61221,61225,62400,61600,61120,61900,62100) then 'Technology & office'
      when n in (61130,61140,62640,62641,62200) then 'Vehicles & equipment'
      when n = 61400 then 'Insurance'
      when n in (61000,62050,62250,62500,62505,62506,62510,62350) then 'Sales, travel & agents'
      when n in (60040,61700,62025,61300) then 'Professional fees & subs'
      when n = 61110 then 'Bank charges'
      when n in (61050) then 'Bad debts'
      when n in (61070,61210,60001) then 'FX gains/losses'
      when n in (61100,61105) then 'Depreciation'
      when n between 81000 and 81199 then 'Interest income'
      when n in (81300,43000) then 'Dividends'
      when n = 83000 then 'Gain on asset sales'
      when n between 90000 and 91499 then 'Interest'
    end as opex_line
  from a
)
select r.account, r.acctname, r.accountype, r.n, r.is_cash, r.service_line,
  coalesce(o.pl_group, r.pl_group) as pl_group,
  coalesce(o.pl_line,
    case when r.pl_group in ('Revenue','Cost of sales') then r.service_line
         when r.pl_group = 'Other operating income' then 'Other operating income'
         when r.pl_group = 'Income tax' then 'Income tax'
         else coalesce(r.opex_line, case when r.pl_group = 'Other income' then 'Other' else 'Admin & other' end)
    end) as pl_line,
  case coalesce(o.pl_group, r.pl_group)
    when 'Revenue' then 1 when 'Cost of sales' then 2 when 'Other operating income' then 3
    when 'Operating expenses' then 4 when 'Other income' then 5 when 'Finance costs' then 6
    when 'Income tax' then 7 end as pl_order,
  -- cash flow class of an account when it is the contra side of a bank movement
  coalesce(o.cf_section, case
    when r.is_cash then 'cash'
    when r.n in (61070,61210,60001,21650,21660) then 'fx'
    when r.n between 12000 and 13999 and r.n not in (12100,12200) or r.n = 83000
      or r.n in (11140,11141,11142,11151,12100,11116,81300,43000) then 'investing'
    when r.n between 22000 and 22999 or r.accountype = 'E' or r.n in (21120,21140,21800) then 'financing'
    else 'operating' end) as cf_section,
  coalesce(o.cf_line, case
    when r.is_cash then 'Cash'
    when r.n in (61070,61210,60001,21650,21660) then 'FX revaluation of cash'
    when r.n between 11200 and 11299 or (r.accountype = 'R' and r.n between 40000 and 44699) then 'Receipts from customers'
    when r.n in (21200,21130,21100,23000,21330) or r.n between 21700 and 21799
      or r.n between 50000 and 59999 then 'Payments to carriers & suppliers'
    when r.n in (62030,62035,62040,62045,62055,62060,21420,21430,21440,21445,21450,11117)
      then 'Payments to staff & PAYE'
    when r.n between 21300 and 21329 then 'GST paid / refunded'
    when r.n in (11120,11130,11131,11170,21340) or r.n between 92000 and 92999 then 'Income tax & RWT'
    when r.n between 81000 and 81199 then 'Interest received'
    when r.n between 91000 and 91499 then 'Interest paid'
    when r.n between 44700 and 49999 then 'Other income received'
    when r.n between 12000 and 13999 and r.n not in (12100,12200) then 'Purchase of fixed assets'
    when r.n = 83000 then 'Proceeds from asset sales'
    when r.n in (11140,11141,11142) then 'Advances to related parties'
    when r.n in (11151,12100,11116) then 'Bonds, deposits & term deposits'
    when r.n in (81300,43000) then 'Dividends received'
    when r.n between 22000 and 22999 then 'Loans drawn / repaid'
    when r.n in (21140) then 'Related party funding'
    when r.accountype = 'E' or r.n in (21120,21800) then 'Dividends & shareholder drawings'
    when r.n between 60000 and 69999 or r.n between 11300 and 11499 or r.n = 12200 then 'Overheads paid'
    else 'Other operating' end) as cf_line,
  coalesce(o.bs_group, case
    when r.accountype = 'A' and (r.is_cash or r.n = 11116) then 'Cash & bank'
    when r.accountype = 'A' and r.n between 11200 and 11299 then 'Trade receivables'
    when r.accountype = 'A' and (r.n between 11300 and 11499 or r.n = 12200) then 'Prepayments'
    when r.accountype = 'A' and r.n in (11120,11130,11131,11170) then 'Tax assets'
    when r.accountype = 'A' and r.n in (11140,11141,11142) then 'Related party advances'
    when r.accountype = 'A' and r.n in (11151,12100) then 'Bonds & deposits'
    when r.accountype = 'A' and r.n between 12000 and 13999 then 'Fixed assets'
    when r.accountype = 'A' then 'Other current assets'
    when r.accountype = 'L' and r.n in (21200,21130,21100) then 'Trade payables'
    when r.accountype = 'L' and (r.n = 23000 or r.n between 21700 and 21799) then 'Accruals'
    when r.accountype = 'L' and r.n between 21300 and 21329 then 'GST'
    when r.accountype = 'L' and r.n = 21330 then 'Customs duty payable'
    when r.accountype = 'L' and r.n in (21340,21420,21430,21440,21445,21450) then 'Payroll liabilities'
    when r.accountype = 'L' and r.n between 22000 and 22999 then 'Borrowings'
    when r.accountype = 'L' and r.n in (21140,21120) then 'Related party & dividends'
    when r.accountype = 'L' then 'Other liabilities'
    when r.accountype = 'E' and r.n in (39999,31000) then 'Share capital'
    when r.accountype = 'E' and r.n between 31100 and 31399 or r.n = 21800 then 'Drawings & dividends'
    when r.accountype = 'E' then 'Retained earnings'
  end) as bs_group
from r
left join finance.account_map_override o on o.account = r.account;

revoke all on all tables in schema finance from public, anon, authenticated;

-- Core finance report functions. Idempotent. Access: has_perm('finance','read').

create table if not exists finance.party_class (
  accountid text primary key, class text not null, note text);
insert into finance.party_class (accountid, class, note)
values ('NZCUST', 'customs', 'NZ Customs: duty + GST paid for clients')
on conflict (accountid) do nothing;

create or replace function finance.assert_access() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('finance', 'read') then
    raise exception 'Finance access required' using errcode = '42501';
  end if;
end $$;

-- balances per account as at a date (TradeWindow: FY open batch YYYY00 + FY movements)
create or replace function finance.bal_asof(p_as_at date)
returns table (account text, amount numeric)
language sql stable as $$
  select t.account, sum(t.amount)
  from finance.gl_trans t
  where t.company = '01'
    and left(t.period, 4) = finance.fy_of(p_as_at)::text
    and t.period <= finance.period_of(p_as_at)
    and (right(t.period, 2) = '00' or t.docdate <= p_as_at)
  group by t.account
$$;

-- creditor payment mix: customs pass-through / overheads / capex / carriers
create or replace view finance.v_creditor_mix as
with inv as (
  select accountid, sum(abs(amt_local)) tot,
         sum(abs(amt_local)) filter (where module = 'COR') cor
  from finance.ledger_invoices
  where d_c_flag = 'C' and company = '01' and doc_date >= date '2025-04-01'
  group by accountid
), gen as (  -- what COR (general) creditor invoices are posted to
  select substring(c.comment from 'Creditor [Aa]ccount:? *([^ ,]+)') as accountid,
         sum(d.amount) filter (where v.n between 12000 and 13999) capex,
         sum(d.amount) filter (where v.pl_group is not null) opex
  from finance.gl_trans c
  join finance.gl_trans d on d.company = c.company and d.batchno = c.batchno and d.amount > 0
  join finance.v_accounts v on v.account = d.account
  where c.account = '21200-00' and c.doctype = 'INV_G' and c.amount < 0
  group by 1
)
select i.accountid,
  case when pc.class = 'customs' then 1 else 0 end::numeric as s_customs,
  case when pc.class = 'customs' then 0
       else coalesce(i.cor / nullif(i.tot, 0), 0)
            * coalesce(g.capex / nullif(coalesce(g.capex, 0) + coalesce(g.opex, 0), 0), 0) end as s_capex,
  case when pc.class = 'customs' then 0
       else coalesce(i.cor / nullif(i.tot, 0), 0)
            * (1 - coalesce(g.capex / nullif(coalesce(g.capex, 0) + coalesce(g.opex, 0), 0), 0)) end as s_overhead
from inv i
left join gen g on g.accountid = i.accountid
left join finance.party_class pc on pc.accountid = i.accountid;

create or replace view finance.v_debtor_mix as
select accountid,
  coalesce(sum(abs(amt_local)) filter (where doctype = 'DIS') / nullif(sum(abs(amt_local)), 0), 0) as s_disb
from finance.ledger_invoices
where d_c_flag = 'D' and company = '01' and doc_date >= date '2025-04-01'
group by accountid;

-- cash-flow lines (direct method) for periods in [p_from, p_to]; excludes FY open batches
create or replace function finance.cf_lines(p_from date, p_to date)
returns table (month date, cf_section text, cf_line text, amount numeric)
language sql stable as $$
  with cb as (
    select distinct t.company, t.batchno
    from finance.gl_trans t join finance.v_accounts v on v.account = t.account
    where v.is_cash and t.company = '01' and right(t.period, 2) <> '00'
      and t.period between finance.period_of(p_from) and finance.period_of(p_to)
  ), l as (
    select finance.period_month(t.period) as month, v.cf_section, v.cf_line, -t.amount as amt,
      t.account, t.doctype, substring(t.comment from 'Acc ([^,]+)') as acct
    from finance.gl_trans t
    join cb on cb.company = t.company and cb.batchno = t.batchno
    join finance.v_accounts v on v.account = t.account
    where not v.is_cash
  ), split as (
    -- supplier payments split by creditor mix
    select l.month, x.sec, x.line, l.amt * x.share as amt
    from l left join finance.v_creditor_mix m on m.accountid = l.acct
    cross join lateral (values
      ('operating', 'Customs duty & GST paid for clients', coalesce(m.s_customs, 0)),
      ('investing', 'Purchase of fixed assets', coalesce(m.s_capex, 0)),
      ('operating', 'Overheads & rent paid', coalesce(m.s_overhead, 0)),
      ('operating', 'Payments to carriers & suppliers',
        1 - coalesce(m.s_customs, 0) - coalesce(m.s_capex, 0) - coalesce(m.s_overhead, 0))
    ) as x(sec, line, share)
    where l.account = '21200-00' and x.share <> 0
    union all
    -- customer receipts split into disbursement recoveries vs trading receipts
    select l.month, 'operating', x.line, l.amt * x.share
    from l left join finance.v_debtor_mix m on m.accountid = l.acct
    cross join lateral (values
      ('Disbursements recovered from clients', coalesce(m.s_disb, 0)),
      ('Receipts from customers', 1 - coalesce(m.s_disb, 0))
    ) as x(line, share)
    where l.account = '11200-00' and x.share <> 0
    union all
    select l.month, l.cf_section,
      case when l.cf_line = 'Overheads paid' then 'Overheads & rent paid' else l.cf_line end, l.amt
    from l where l.account not in ('21200-00', '11200-00')
  )
  select month, sec, line, sum(amt) from split
  group by 1, 2, 3 having round(sum(amt), 2) <> 0
$$;

revoke all on all tables in schema finance from public, anon, authenticated;
revoke all on all functions in schema finance from public, anon, authenticated;

-- Public report RPCs (Finance module). SECURITY DEFINER + has_perm('finance','read') gate.

create or replace function public.fin_pl_monthly(p_from date, p_to date)
returns table (month date, pl_order int, pl_group text, pl_line text, amount numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  select finance.period_month(t.period), v.pl_order, v.pl_group, v.pl_line, round(-sum(t.amount), 2)
  from finance.gl_trans t join finance.v_accounts v on v.account = t.account
  where t.company = '01' and v.pl_group is not null and right(t.period, 2) <> '00'
    and t.period between finance.period_of(p_from) and finance.period_of(p_to)
  group by 1, 2, 3, 4;
end $$;

create or replace function public.fin_pl_accounts(p_from date, p_to date, p_group text, p_line text)
returns table (account text, acctname text, month date, amount numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  select v.account, v.acctname, finance.period_month(t.period), round(-sum(t.amount), 2)
  from finance.gl_trans t join finance.v_accounts v on v.account = t.account
  where t.company = '01' and v.pl_group = p_group and v.pl_line = p_line
    and right(t.period, 2) <> '00'
    and t.period between finance.period_of(p_from) and finance.period_of(p_to)
  group by 1, 2, 3;
end $$;

create or replace function public.fin_balance_sheet(p_as_at date)
returns table (side text, side_order int, bs_group text, account text, acctname text, amount numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  with b as (select * from finance.bal_asof(p_as_at))
  select case v.accountype when 'A' then 'Assets' when 'L' then 'Liabilities' else 'Equity' end,
         case v.accountype when 'A' then 1 when 'L' then 2 else 3 end,
         v.bs_group, v.account, v.acctname,
         round(case when v.accountype = 'A' then b.amount else -b.amount end, 2)
  from b join finance.v_accounts v on v.account = b.account
  where v.accountype in ('A', 'L', 'E') and round(b.amount, 2) <> 0
  union all
  select 'Equity', 3, 'Current year earnings', null, 'Profit for the year to date',
         round(-sum(b.amount), 2)
  from b join finance.v_accounts v on v.account = b.account
  where v.accountype in ('R', 'X');
end $$;

create or replace function public.fin_cashflow_monthly(p_from date, p_to date)
returns table (month date, cf_section text, cf_line text, amount numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
declare m date;
begin
  perform finance.assert_access();
  return query select c.month, c.cf_section, c.cf_line, round(c.amount, 2)
               from finance.cf_lines(p_from, p_to) c;
  -- closing cash per month (from balances, so it always ties to the ledger)
  for m in select generate_series(date_trunc('month', p_from)::date,
                                  date_trunc('month', p_to)::date, interval '1 month')::date loop
    return query
    select m, 'balance'::text, 'Closing cash'::text, round(coalesce(sum(b.amount), 0), 2)
    from finance.bal_asof((m + interval '1 month - 1 day')::date) b
    join finance.v_accounts v on v.account = b.account where v.is_cash;
  end loop;
end $$;

-- one row per month: P&L totals + month-end working-capital balances
create or replace function public.fin_kpi_monthly(p_from date, p_to date)
returns table (month date, revenue numeric, cost_of_sales numeric, gross_profit numeric,
  other_op_income numeric, opex numeric, people numeric, premises numeric, ebit numeric,
  net_profit numeric, cash numeric, receivables numeric, payables numeric, accruals numeric,
  gst numeric, duty_payable numeric, related_party numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
declare m date; me date;
begin
  perform finance.assert_access();
  for m in select generate_series(date_trunc('month', p_from)::date,
                                  date_trunc('month', p_to)::date, interval '1 month')::date loop
    me := (m + interval '1 month - 1 day')::date;
    return query
    with pl as (
      select v.pl_group g, v.pl_line l, -sum(t.amount) a
      from finance.gl_trans t join finance.v_accounts v on v.account = t.account
      where t.company = '01' and v.pl_group is not null and t.period = finance.period_of(m)
      group by 1, 2
    ), bs as (
      select v.bs_group g, v.accountype ty, sum(b.amount) a
      from finance.bal_asof(me) b join finance.v_accounts v on v.account = b.account
      group by 1, 2
    )
    select m,
      round(coalesce((select sum(a) from pl where g = 'Revenue'), 0), 2),
      round(coalesce((select -sum(a) from pl where g = 'Cost of sales'), 0), 2),
      round(coalesce((select sum(a) from pl where g in ('Revenue', 'Cost of sales')), 0), 2),
      round(coalesce((select sum(a) from pl where g = 'Other operating income'), 0), 2),
      round(coalesce((select -sum(a) from pl where g = 'Operating expenses'), 0), 2),
      round(coalesce((select -sum(a) from pl where g = 'Operating expenses' and l = 'People'), 0), 2),
      round(coalesce((select -sum(a) from pl where g = 'Operating expenses' and l = 'Premises'), 0), 2),
      round(coalesce((select sum(a) from pl where g in ('Revenue', 'Cost of sales',
        'Other operating income', 'Operating expenses')), 0), 2),
      round(coalesce((select sum(a) from pl), 0), 2),
      round(coalesce((select sum(a) from bs where g = 'Cash & bank'), 0), 2),
      round(coalesce((select sum(a) from bs where g = 'Trade receivables'), 0), 2),
      round(coalesce((select -sum(a) from bs where g = 'Trade payables'), 0), 2),
      round(coalesce((select -sum(a) from bs where g = 'Accruals'), 0), 2),
      round(coalesce((select -sum(a) from bs where g = 'GST'), 0), 2),
      round(coalesce((select -sum(a) from bs where g = 'Customs duty payable'), 0), 2),
      round(coalesce((select sum(a) from bs where g = 'Related party advances'), 0), 2);
  end loop;
end $$;

-- receivables (D) or payables (C) aging from open ledger items, with payment behaviour
create or replace function public.fin_aging(p_kind text)
returns table (accountid text, name text, terms text, credit_limit numeric, is_related boolean,
  current_amt numeric, d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric,
  total numeric, unapplied numeric, open_items int, oldest_due date,
  avg_days_to_pay numeric, avg_days_late numeric, billed_12m numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  if p_kind not in ('D', 'C') then raise exception 'p_kind must be D or C'; end if;
  return query
  with open_i as (
    select i.accountid, i.balance, i.datedue, i.doc_date,
           current_date - coalesce(i.datedue, i.doc_date) as late
    from finance.ledger_invoices i
    where i.d_c_flag = p_kind and i.company = '01' and abs(coalesce(i.balance, 0)) >= 0.01
  ), agg as (
    select o.accountid,
      sum(o.balance) filter (where o.late <= 0) c0,
      sum(o.balance) filter (where o.late between 1 and 30) c1,
      sum(o.balance) filter (where o.late between 31 and 60) c2,
      sum(o.balance) filter (where o.late between 61 and 90) c3,
      sum(o.balance) filter (where o.late > 90) c4,
      sum(o.balance) tot, count(*)::int n, min(o.datedue) oldest
    from open_i o group by o.accountid
  ), unap as (
    select r.accountid, sum(r.balance) u
    from finance.receipts r
    where r.d_c_flag = p_kind and r.company = '01' and abs(coalesce(r.balance, 0)) >= 0.01
    group by r.accountid
  ), paid as (  -- allocations in last 12 months against invoices we hold
    select a.accountid,
      sum(a.amount * (a.date1::date - i.doc_date)) / nullif(sum(a.amount), 0) dtp,
      sum(a.amount * (a.date1::date - coalesce(i.datedue, i.doc_date))) / nullif(sum(a.amount), 0) late
    from finance.allocations a
    join finance.ledger_invoices i on i.company = a.company and i.d_c_flag = a.d_c_flag
      and i.number = a.invoice and i.accountid = a.accountid
    where a.d_c_flag = p_kind and a.company = '01' and a.amount > 0
      and a.date1 >= current_date - 365
    group by a.accountid
  ), billed as (
    select i.accountid, sum(i.amt_local) b from finance.ledger_invoices i
    where i.d_c_flag = p_kind and i.company = '01' and i.doc_date >= current_date - 365
    group by i.accountid
  )
  select g.accountid, p.name,
    case when p_kind = 'D' then coalesce(p.term_f, p.payment_term) else coalesce(p.creditor_term, p.payment_term) end,
    coalesce(p.debtor_cred_lim, p.cred_lim),
    g.accountid in ('3RN', 'NRR', 'UBNAN') or coalesce(p.name, '') ilike '%u%b%freight%',
    round(coalesce(g.c0, 0), 2), round(coalesce(g.c1, 0), 2), round(coalesce(g.c2, 0), 2),
    round(coalesce(g.c3, 0), 2), round(coalesce(g.c4, 0), 2), round(coalesce(g.tot, 0), 2),
    round(-coalesce(u.u, 0), 2), coalesce(g.n, 0), g.oldest,
    round(pd.dtp, 1), round(pd.late, 1), round(coalesce(bl.b, 0), 2)
  from agg g
  left join finance.parties p on p.accountid = g.accountid
  left join unap u on u.accountid = g.accountid
  left join paid pd on pd.accountid = g.accountid
  left join billed bl on bl.accountid = g.accountid;
end $$;

create or replace function public.fin_sync_status()
returns table (table_name text, rows int, synced_at timestamptz, last_gl_date date)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  select s.table_name, s.rows, s.synced_at,
         (select max(t.docdate) from finance.gl_trans t where t.docdate <= current_date)
  from finance.sync_state s;
end $$;

revoke all on function public.fin_pl_monthly(date, date) from public, anon;
revoke all on function public.fin_pl_accounts(date, date, text, text) from public, anon;
revoke all on function public.fin_balance_sheet(date) from public, anon;
revoke all on function public.fin_cashflow_monthly(date, date) from public, anon;
revoke all on function public.fin_kpi_monthly(date, date) from public, anon;
revoke all on function public.fin_aging(text) from public, anon;
revoke all on function public.fin_sync_status() from public, anon;
grant execute on function public.fin_pl_monthly(date, date) to authenticated;
grant execute on function public.fin_pl_accounts(date, date, text, text) to authenticated;
grant execute on function public.fin_balance_sheet(date) to authenticated;
grant execute on function public.fin_cashflow_monthly(date, date) to authenticated;
grant execute on function public.fin_kpi_monthly(date, date) to authenticated;
grant execute on function public.fin_aging(text) to authenticated;
grant execute on function public.fin_sync_status() to authenticated;

notify pgrst, 'reload schema';

create or replace function public.fin_cash_forecast(p_weeks int default 13)
returns table (week_start date, opening numeric, ar_existing numeric, ap_existing numeric,
  new_receipts numeric, new_payments numeric, payroll numeric, overheads numeric,
  tax_gst numeric, other numeric, net numeric, closing numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
declare
  v_start date := date_trunc('week', current_date)::date;
  v_open numeric; v_dso numeric; v_dpo numeric; v_wk numeric := 52.0 / 12.0;
  r_rec numeric; r_pay numeric; r_staff numeric; r_ovh numeric; r_tax numeric; r_oth numeric;
  v_m0 date := (date_trunc('month', current_date) - interval '3 months')::date;
  v_m1 date := (date_trunc('month', current_date) - interval '1 day')::date;
begin
  perform finance.assert_access();
  select coalesce(sum(b.amount), 0) into v_open
  from finance.bal_asof(current_date) b join finance.v_accounts v on v.account = b.account where v.is_cash;

  -- run-rates from last 3 closed months of actual cash flow (monthly avg / weeks per month)
  select coalesce(sum(c.amount) filter (where c.cf_line in ('Receipts from customers', 'Disbursements recovered from clients')), 0) / 3 / v_wk,
         coalesce(sum(c.amount) filter (where c.cf_line in ('Payments to carriers & suppliers', 'Customs duty & GST paid for clients')), 0) / 3 / v_wk,
         coalesce(sum(c.amount) filter (where c.cf_line = 'Payments to staff & PAYE'), 0) / 3 / v_wk,
         coalesce(sum(c.amount) filter (where c.cf_line = 'Overheads & rent paid'), 0) / 3 / v_wk,
         coalesce(sum(c.amount) filter (where c.cf_line in ('GST paid / refunded', 'Income tax & RWT')), 0) / 3 / v_wk,
         coalesce(sum(c.amount) filter (where c.cf_line in ('Interest paid', 'Interest received', 'Loans drawn / repaid')), 0) / 3 / v_wk
    into r_rec, r_pay, r_staff, r_ovh, r_tax, r_oth
  from finance.cf_lines(v_m0, v_m1) c;

  -- collection / payment lags (days) from open balances vs last 90 days billed
  select greatest(14, least(120, coalesce(sum(balance) filter (where d_c_flag = 'D' and abs(balance) >= 0.01)
           / nullif(sum(amt_local) filter (where d_c_flag = 'D' and doc_date >= current_date - 90), 0) * 90, 45))),
         greatest(14, least(120, coalesce(sum(balance) filter (where d_c_flag = 'C' and abs(balance) >= 0.01)
           / nullif(sum(amt_local) filter (where d_c_flag = 'C' and doc_date >= current_date - 90), 0) * 90, 30)))
    into v_dso, v_dpo
  from finance.ledger_invoices where company = '01';

  return query
  with late as (
    select a.d_c_flag, a.accountid,
      sum(a.amount * (a.date1::date - coalesce(i.datedue, i.doc_date))) / nullif(sum(a.amount), 0) d
    from finance.allocations a
    join finance.ledger_invoices i on i.company = a.company and i.d_c_flag = a.d_c_flag
      and i.number = a.invoice and i.accountid = a.accountid
    where a.company = '01' and a.amount > 0 and a.date1 >= current_date - 365
    group by 1, 2
  ), late_all as (
    select d_c_flag, avg(d) d from late group by 1
  ), unap as (
    select r.d_c_flag, r.accountid, sum(r.balance) u from finance.receipts r
    where r.company = '01' and abs(coalesce(r.balance, 0)) >= 0.01 group by 1, 2
  ), gross as (
    select i.d_c_flag, i.accountid, sum(i.balance) g from finance.ledger_invoices i
    where i.company = '01' and abs(coalesce(i.balance, 0)) >= 0.01 group by 1, 2
  ), factor as (  -- scale open items down by cash already received but not allocated
    select g.d_c_flag, g.accountid,
      case when g.g > 0 then greatest(0, g.g - coalesce(u.u, 0)) / g.g else 1 end f
    from gross g left join unap u on u.d_c_flag = g.d_c_flag and u.accountid = g.accountid
  ), items as (
    select i.d_c_flag, i.balance * coalesce(fa.f, 1) as balance,
      greatest(v_start, coalesce(i.datedue, i.doc_date)
        + greatest(0, least(90, coalesce(l.d, la.d, 0)))::int) as exp_date,
      current_date - coalesce(i.datedue, i.doc_date) as overdue
    from finance.ledger_invoices i
    left join late l on l.d_c_flag = i.d_c_flag and l.accountid = i.accountid
    left join late_all la on la.d_c_flag = i.d_c_flag
    left join factor fa on fa.d_c_flag = i.d_c_flag and fa.accountid = i.accountid
    where i.company = '01' and abs(coalesce(i.balance, 0)) >= 0.01
  ), wk as (
    select gs as w, (v_start + gs * 7) as ws from generate_series(0, p_weeks - 1) gs
  ), sched as (
    select wk.w, wk.ws,
      coalesce((select sum(balance) from items where d_c_flag = 'D' and overdue <= 120
                and (exp_date - v_start) / 7 = wk.w), 0) as ar,
      coalesce((select -sum(balance) from items where d_c_flag = 'C'
                and (exp_date - v_start) / 7 = wk.w), 0) as ap,
      r_rec * least(1.0, (wk.w + 1) * 7.0 / v_dso) as nr,
      r_pay * least(1.0, (wk.w + 1) * 7.0 / v_dpo) as np
    from wk
  ), lines as (
    select s.*, s.ar + s.ap + s.nr + s.np + r_staff + r_ovh + r_tax + r_oth as net from sched s
  )
  select l.ws,
    round(v_open + coalesce(sum(l.net) over (order by l.w rows between unbounded preceding and 1 preceding), 0), 0),
    round(l.ar, 0), round(l.ap, 0), round(l.nr, 0), round(l.np, 0),
    round(r_staff, 0), round(r_ovh, 0), round(r_tax, 0), round(r_oth, 0), round(l.net, 0),
    round(v_open + sum(l.net) over (order by l.w), 0)
  from lines l order by l.w;
end $$;

create or replace function public.fin_flags()
returns table (severity text, code text, title text, detail text, amount numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
declare v_today date := current_date;
begin
  perform finance.assert_access();
  return query
  with b as (select * from finance.bal_asof(v_today)),
  bal as (select v.account, v.n, v.is_cash, v.acctname, b.amount from b join finance.v_accounts v on v.account = b.account),
  ar as (select * from finance.ledger_invoices where company = '01' and d_c_flag = 'D' and abs(coalesce(balance, 0)) >= 0.01),
  ap as (select * from finance.ledger_invoices where company = '01' and d_c_flag = 'C' and abs(coalesce(balance, 0)) >= 0.01),
  lim as (
    select a.accountid, sum(a.balance) tot, max(coalesce(p.debtor_cred_lim, p.cred_lim)) lim
    from ar a left join finance.parties p on p.accountid = a.accountid group by 1
  )
  select * from (
    select 'high'::text, 'open_month'::text, 'Month not closed in TradeWindow'::text,
      'Supplier invoices of this value are sitting in Accruals (23000) without job costs posted. Gross profit for the latest month is overstated until jobs are costed.'::text,
      round(sum(amount), 0)
    from bal where n = 23000 having sum(amount) > 50000
    union all
    select 'high', 'ar_90', 'Receivables over 90 days overdue',
      count(distinct accountid) || ' customers. Chase or provide for doubtful debts.',
      round(sum(balance), 0)
    from ar where current_date - coalesce(datedue, doc_date) > 90 having sum(balance) > 0
    union all
    select 'medium', 'over_limit', 'Customers over credit limit',
      count(*) || ' accounts exceed their limit by a combined amount shown.',
      round(sum(tot - lim), 0)
    from lim where lim > 0 and lim < 99999999 and tot > lim having count(*) > 0
    union all
    select 'medium', 'unapplied', 'Unapplied customer receipts',
      'Cash received but not matched to invoices. Allocate so aging and statements are right.',
      round(sum(balance), 0)
    from finance.receipts where company = '01' and d_c_flag = 'D' and abs(coalesce(balance, 0)) >= 0.01
    having abs(sum(balance)) > 1
    union all
    select 'medium', 'related_party', 'Related-party balances',
      'Advances to / funding from related entities (3RN, NRR, related companies). Check terms, interest and security.',
      round(sum(amount), 0)
    from bal where n in (11140, 11141, 11142, 21140) having abs(sum(amount)) > 1
    union all
    select 'medium', 'no_depreciation', 'No depreciation posted this year',
      'Fixed assets are on the balance sheet but no depreciation has been expensed. Profit is overstated by the annual charge.',
      round((select sum(amount) from bal where n between 12000 and 13999 and n not in (12100, 12200)), 0)
    where not exists (select 1 from finance.gl_trans t where t.account = '61100-00'
                      and left(t.period, 4) = finance.fy_of(v_today)::text)
    union all
    select 'low', 'no_tax', 'No income tax expense posted',
      'Profit shown is before tax. Provisional tax is held as an asset (11120).', null::numeric
    where not exists (select 1 from finance.gl_trans t where t.account = '92000-00'
                      and left(t.period, 4) = finance.fy_of(v_today)::text)
    union all
    select 'high', 'neg_bank', 'Bank account in overdraft per ledger', string_agg(acctname, ', '), round(sum(amount), 0)
    from bal where is_cash and amount < -1 having count(*) > 0
    union all
    select 'medium', 'future_dated', 'Future-dated postings',
      count(*) || ' GL lines dated after today (prepayment schedules / typos), latest ' || max(docdate)::text,
      round(sum(abs(amount)) / 2, 0)
    from finance.gl_trans where docdate > current_date having count(*) > 0
    union all
    select 'low', 'held_batches', 'GL batches on hold or not posted', count(*) || ' batches', null::numeric
    from finance.gl_batches where coalesce(hold, 'N') = 'Y' or coalesce(posted, 'Y') <> 'Y' having count(*) > 0
    union all
    select 'medium', 'ar_recon', 'Receivables ledger vs GL difference',
      'Open customer items less unapplied cash, compared with the Trade Debtors control account.', round(z.d, 0)
    from (select (select coalesce(sum(balance), 0) from ar)
        - (select coalesce(sum(balance), 0) from finance.receipts where company = '01' and d_c_flag = 'D' and abs(coalesce(balance, 0)) >= 0.01)
        - (select coalesce(sum(amount), 0) from bal where n = 11200) as d) z
    where abs(z.d) > 1000
    union all
    select 'medium', 'ap_recon', 'Payables ledger vs GL difference',
      'Open supplier items less unapplied payments, compared with the Trade Creditors control account.', round(z.d, 0)
    from (select (select coalesce(sum(balance), 0) from ap)
        - (select coalesce(sum(balance), 0) from finance.receipts where company = '01' and d_c_flag = 'C' and abs(coalesce(balance, 0)) >= 0.01)
        + (select coalesce(sum(amount), 0) from bal where n = 21200) as d) z
    where abs(z.d) > 1000
    union all
    select 'low', 'stale', 'Finance data is more than 2 days old',
      'Last GL posting ' || max(docdate)::text || '. Run sync_finance.py.', null::numeric
    from finance.gl_trans where docdate <= current_date having max(docdate) < current_date - 2
  ) x;
end $$;

revoke all on function public.fin_cash_forecast(int) from public, anon;
revoke all on function public.fin_flags() from public, anon;
grant execute on function public.fin_cash_forecast(int) to authenticated;
grant execute on function public.fin_flags() to authenticated;

notify pgrst, 'reload schema';

-- Set-based fin_kpi_monthly: one pass over GL instead of a balance query per month.
create or replace function public.fin_kpi_monthly(p_from date, p_to date)
returns table (month date, revenue numeric, cost_of_sales numeric, gross_profit numeric,
  other_op_income numeric, opex numeric, people numeric, premises numeric, ebit numeric,
  net_profit numeric, cash numeric, receivables numeric, payables numeric, accruals numeric,
  gst numeric, duty_payable numeric, related_party numeric)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  with mv as (
    select v.bs_group, v.pl_group, v.pl_line, v.accountype, left(t.period, 4)::int as fy,
      finance.period_month(case when right(t.period, 2) = '00' then left(t.period, 4) || '01' else t.period end) as mo,
      right(t.period, 2) = '00' as is_ob, t.amount
    from finance.gl_trans t join finance.v_accounts v on v.account = t.account
    where t.company = '01'
      and t.period between finance.fy_of(p_from)::text || '00' and finance.period_of(p_to)
  ), months as (
    select gs::date as m from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') gs
  ), pl as (
    select mo,
      sum(-amount) filter (where pl_group = 'Revenue') rev,
      sum(amount) filter (where pl_group = 'Cost of sales') cos,
      sum(-amount) filter (where pl_group = 'Other operating income') ooi,
      sum(amount) filter (where pl_group = 'Operating expenses') ox,
      sum(amount) filter (where pl_group = 'Operating expenses' and pl_line = 'People') ppl,
      sum(amount) filter (where pl_group = 'Operating expenses' and pl_line = 'Premises') prem,
      sum(-amount) filter (where pl_group is not null) net
    from mv where pl_group is not null and not is_ob group by mo
  ), bsm as (
    select fy, mo, bs_group, sum(amount) a from mv where accountype in ('A', 'L', 'E') group by 1, 2, 3
  ), bal as (
    select m.m, b.bs_group, sum(b.a) a
    from months m join bsm b on b.fy = finance.fy_of(m.m) and b.mo <= m.m
    group by 1, 2
  )
  select m.m,
    round(coalesce(pl.rev, 0), 2), round(coalesce(pl.cos, 0), 2),
    round(coalesce(pl.rev, 0) - coalesce(pl.cos, 0), 2), round(coalesce(pl.ooi, 0), 2),
    round(coalesce(pl.ox, 0), 2), round(coalesce(pl.ppl, 0), 2), round(coalesce(pl.prem, 0), 2),
    round(coalesce(pl.rev, 0) - coalesce(pl.cos, 0) + coalesce(pl.ooi, 0) - coalesce(pl.ox, 0), 2),
    round(coalesce(pl.net, 0), 2),
    round(coalesce((select a from bal where bal.m = m.m and bs_group = 'Cash & bank'), 0), 2),
    round(coalesce((select a from bal where bal.m = m.m and bs_group = 'Trade receivables'), 0), 2),
    round(coalesce((select -a from bal where bal.m = m.m and bs_group = 'Trade payables'), 0), 2),
    round(coalesce((select -a from bal where bal.m = m.m and bs_group = 'Accruals'), 0), 2),
    round(coalesce((select -a from bal where bal.m = m.m and bs_group = 'GST'), 0), 2),
    round(coalesce((select -a from bal where bal.m = m.m and bs_group = 'Customs duty payable'), 0), 2),
    round(coalesce((select a from bal where bal.m = m.m and bs_group = 'Related party advances'), 0), 2)
  from months m left join pl on pl.mo = m.m
  order by m.m;
end $$;

notify pgrst, 'reload schema';

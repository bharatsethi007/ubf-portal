-- Month-end close checklist (Finance > Month-end close).
-- Already applied to cpnkudbdzgnzmodhsrbf via MCP (finance_month_close_v1 + fixes). DO NOT RE-RUN; repo parity only.

-- Month-end close checklist: ledger checks for a month, per-check review notes and a month sign-off. Idempotent.

create table if not exists finance.close_reviews (
  month date not null, code text not null,
  status text not null check (status in ('open', 'done', 'accepted')),
  note text, reviewed_by uuid default auth.uid(), reviewed_at timestamptz default now(),
  primary key (month, code));
create table if not exists finance.close_months (
  month date primary key, closed boolean not null default false, note text, summary jsonb,
  closed_by uuid default auth.uid(), closed_at timestamptz default now());
revoke all on all tables in schema finance from public, anon, authenticated;

create or replace function finance.user_label(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select su.full_name from public.staff_users su where su.user_id = p
$$;

create or replace function public.fin_close_checklist(p_month date)
returns jsonb
language plpgsql stable security definer set search_path = finance, public as $$
declare
  m0 date := date_trunc('month', p_month)::date;
  e date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  p text := finance.period_of(m0);
  checks jsonb := '[]'::jsonb;
  r record; v numeric; n int; t text; avg3 numeric; cur numeric; leaks jsonb;
begin
  perform finance.assert_access();

  -- 1 bank statements reconciled to month end
  select count(*) filter (where b.stmt_date < e),
         string_agg(b.name || ' to ' || to_char(b.stmt_date, 'DD Mon'), ', ' order by b.number) filter (where b.stmt_date < e),
         coalesce(sum(abs(g.amount - b.stmt_bal)) filter (where b.currency in ('NZD', 'NZ') and b.stmt_date >= e and abs(g.amount - b.stmt_bal) > 1), 0)
    into n, t, v
  from finance.bank_accounts b
  left join lateral (select coalesce(sum(x.amount), 0) amount from finance.bal_asof(b.stmt_date) x where x.account = b.gl_account) g on true
  where b.company = '01' and b.stmt_date >= e - 400;
  checks := checks || jsonb_build_object('code', 'bank_rec', 'area', 'Bank', 'title', 'Bank statements reconciled to month end',
    'status', case when n = 0 and v = 0 then 'pass' else 'fail' end, 'amount', nullif(v, 0), 'count', n,
    'detail', case when n = 0 and v = 0 then 'Every active bank account is reconciled to a statement on or after ' || to_char(e, 'DD Mon') || '.'
      when n > 0 then 'Not yet reconciled: ' || t || '.' else 'Ledger differs from the NZD bank statement balance.' end,
    'action', 'Reconcile in TradeWindow cashbook (Bank Reconciliation).');

  -- 2 old unpresented items
  select count(*), coalesce(sum(abs(c.amount_local)), 0) into n, v
  from finance.cashbook c where c.company = '01' and c.date1::date <= e - 60 and (c.cleared is null or c.cleared in ('N', 'O'));
  checks := checks || jsonb_build_object('code', 'bank_stale', 'area', 'Bank', 'title', 'No old unpresented cashbook items',
    'status', case when n = 0 then 'pass' else 'warn' end, 'amount', nullif(v, 0), 'count', n,
    'detail', case when n = 0 then 'No uncleared items older than 60 days.' else n || ' cashbook items more than 60 days old have not cleared the bank.' end,
    'action', 'Cancel stale cheques or deposits, or clear them against the statement.');

  -- 3 suspense
  select coalesce(sum(b.amount), 0) into v from finance.bal_asof(e) b join finance.v_accounts a on a.account = b.account where a.acctname ilike '%suspense%';
  checks := checks || jsonb_build_object('code', 'suspense', 'area', 'Ledger', 'title', 'Suspense account cleared',
    'status', case when abs(v) < 1 then 'pass' else 'fail' end, 'amount', nullif(round(v, 2), 0),
    'detail', case when abs(v) < 1 then 'Nothing left in suspense.' else 'Balance left in the suspense account at month end.' end,
    'action', 'Journal suspense items to the right accounts.');

  -- 4 held / unposted batches
  select count(*) into n from finance.gl_batches b
  where b.company = '01' and b.period <= p and (coalesce(b.hold, 'N') = 'Y' or coalesce(b.posted, 'Y') <> 'Y');
  checks := checks || jsonb_build_object('code', 'held_batches', 'area', 'Ledger', 'title', 'No GL batches on hold',
    'status', case when n = 0 then 'pass' else 'fail' end, 'count', n,
    'detail', case when n = 0 then 'All batches for the month are posted.' else 'Batches on hold or unposted for this month or earlier: ' || n || '.' end,
    'action', 'Post or reverse held batches in TradeWindow.');

  -- 5 unposted job costs (Accruals 23000 debit)
  select coalesce(sum(b.amount), 0) into v from finance.bal_asof(e) b join finance.v_accounts a on a.account = b.account where a.n = 23000;
  checks := checks || jsonb_build_object('code', 'unposted_costs', 'area', 'Jobs', 'title', 'Job costs posted',
    'status', case when v < 50000 then 'pass' when v < 250000 then 'warn' else 'fail' end, 'amount', round(greatest(v, 0), 2),
    'detail', case when v < 50000 then 'Supplier invoices are costed to jobs.' else 'Supplier invoices received but not costed to jobs at month end. Gross profit is overstated by this amount.' end,
    'action', 'Cost the open jobs in TradeWindow, then re-sync.', 'view', 'leaks');

  -- 6 supplier billed, customer not invoiced
  select coalesce(jsonb_agg(x), '[]') into leaks from public.fin_margin_leaks() x where x.category = 'not_invoiced' and x.first_bill <= e and x.review_status is null;
  select count(*), coalesce(sum((x->>'cost_billed')::numeric), 0) into n, v from jsonb_array_elements(leaks) x;
  checks := checks || jsonb_build_object('code', 'not_invoiced', 'area', 'Jobs', 'title', 'Every costed job invoiced',
    'status', case when n = 0 then 'pass' else 'warn' end, 'amount', nullif(round(v, 2), 0), 'count', n,
    'detail', case when n = 0 then 'No job has supplier costs without a customer invoice.' else n || ' jobs have supplier costs but no customer invoice.' end,
    'action', 'Invoice the jobs or mark them reviewed in Margin leaks.', 'view', 'leaks');

  -- 7 customs entries paid on time (due the 20th of the month after entry)
  select count(*), coalesce(sum(i.balance), 0) into n, v from finance.ledger_invoices i
  where i.company = '01' and i.d_c_flag = 'C' and i.accountid in (select accountid from finance.party_class where class = 'customs')
    and abs(coalesce(i.balance, 0)) >= 0.01 and i.doc_date < m0 and i.doc_date >= m0 - 120;
  checks := checks || jsonb_build_object('code', 'customs_paid', 'area', 'Payables', 'title', 'Customs deferred payment made',
    'status', case when n = 0 then 'pass' when abs(v) < 1000 then 'warn' else 'fail' end, 'amount', nullif(round(v, 2), 0), 'count', n,
    'detail', case when n = 0 then 'All Customs entries due by the 20th are paid.' else n || ' Customs entries due by the 20th are still open in TradeWindow.' end,
    'action', 'Confirm the Customs payment and allocate it to the entries.', 'view', 'duty');

  -- 8 unapplied customer receipts
  select count(*), coalesce(sum(rc.balance), 0), count(*) filter (where rc.date1::date < e - 30) into n, v, avg3
  from finance.receipts rc where rc.company = '01' and rc.d_c_flag = 'D' and abs(coalesce(rc.balance, 0)) >= 0.01 and rc.date1::date <= e;
  checks := checks || jsonb_build_object('code', 'unapplied', 'area', 'Debtors', 'title', 'Customer receipts allocated',
    'status', case when v < 5000 then 'pass' when avg3 = 0 then 'warn' else 'fail' end, 'amount', nullif(round(v, 2), 0), 'count', n,
    'detail', case when v < 5000 then 'Receipts are matched to invoices.' else n || ' receipts not allocated to invoices, ' || avg3 || ' older than 30 days.' end,
    'action', 'Allocate in TradeWindow using the suggestions in Match payments.', 'view', 'matching');

  -- 9 / 10 sub-ledgers agree with control accounts (as at last sync)
  for r in select * from public.fin_flags() f where f.code in ('ar_recon', 'ap_recon') loop
    checks := checks || jsonb_build_object('code', r.code, 'area', case when r.code = 'ar_recon' then 'Debtors' else 'Payables' end,
      'title', case when r.code = 'ar_recon' then 'Debtors ledger agrees to GL' else 'Creditors ledger agrees to GL' end,
      'status', 'fail', 'amount', r.amount, 'detail', r.detail || ' Checked at the last sync.', 'action', 'Find the unposted or mis-posted item.');
  end loop;
  if not exists (select 1 from jsonb_array_elements(checks) c where c->>'code' = 'ar_recon') then
    checks := checks || jsonb_build_object('code', 'ar_recon', 'area', 'Debtors', 'title', 'Debtors ledger agrees to GL', 'status', 'pass',
      'detail', 'Open customer items agree to Trade Debtors within $1,000 at the last sync.');
  end if;
  if not exists (select 1 from jsonb_array_elements(checks) c where c->>'code' = 'ap_recon') then
    checks := checks || jsonb_build_object('code', 'ap_recon', 'area', 'Payables', 'title', 'Creditors ledger agrees to GL', 'status', 'pass',
      'detail', 'Open supplier items agree to Trade Creditors within $1,000 at the last sync.');
  end if;

  -- 11 debtors over 90 days
  select count(distinct i.accountid), coalesce(sum(i.balance), 0) into n, v from finance.ledger_invoices i
  where i.company = '01' and i.d_c_flag = 'D' and abs(coalesce(i.balance, 0)) >= 0.01 and e - coalesce(i.datedue, i.doc_date) > 90 and i.doc_date <= e;
  checks := checks || jsonb_build_object('code', 'ar_90', 'area', 'Debtors', 'title', 'Debts over 90 days reviewed',
    'status', case when v < 10000 then 'pass' else 'warn' end, 'amount', nullif(round(v, 2), 0), 'count', n,
    'detail', n || ' customers owe ' || to_char(round(v), 'FM$999,999,990') || ' more than 90 days overdue. Decide chase, payment plan or bad-debt provision.',
    'action', 'Review in Collections; provide for anything unlikely to be paid.', 'view', 'collections');

  -- 12 payroll, 13 rent, 14 revenue: month vs average of the three months before
  with mm as (select generate_series(m0 - interval '3 months', m0, interval '1 month')::date mon),
  s as (
    select mm.mon,
      coalesce((select sum(t.amount) from finance.gl_trans t join finance.v_accounts a on a.account = t.account
        where t.company = '01' and t.period = finance.period_of(mm.mon) and a.pl_line = 'People'), 0) people,
      coalesce((select sum(t.amount) from finance.gl_trans t join finance.v_accounts a on a.account = t.account
        where t.company = '01' and t.period = finance.period_of(mm.mon) and a.pl_line = 'Premises'), 0) premises,
      -coalesce((select sum(t.amount) from finance.gl_trans t join finance.v_accounts a on a.account = t.account
        where t.company = '01' and t.period = finance.period_of(mm.mon) and a.pl_group = 'Revenue'), 0) revenue
    from mm)
  select jsonb_build_object(
    'people', jsonb_build_object('cur', (select people from s where mon = m0), 'avg', (select avg(people) from s where mon < m0)),
    'premises', jsonb_build_object('cur', (select premises from s where mon = m0), 'avg', (select avg(premises) from s where mon < m0)),
    'revenue', jsonb_build_object('cur', (select revenue from s where mon = m0), 'avg', (select avg(revenue) from s where mon < m0)))
  into leaks;

  cur := (leaks->'people'->>'cur')::numeric; avg3 := (leaks->'people'->>'avg')::numeric;
  checks := checks || jsonb_build_object('code', 'payroll', 'area', 'P&L review', 'title', 'Payroll posted',
    'status', case when cur <= 0 then 'fail' when avg3 > 0 and (cur < 0.75 * avg3 or cur > 1.3 * avg3) then 'warn' else 'pass' end,
    'amount', round(cur, 2), 'detail', 'Staff cost ' || to_char(round(cur), 'FM$999,999,990') || ' against a three-month average of ' || to_char(round(coalesce(avg3, 0)), 'FM$999,999,990') || '.',
    'action', 'Check every pay run and the PAYE journal are posted.');
  cur := (leaks->'premises'->>'cur')::numeric; avg3 := (leaks->'premises'->>'avg')::numeric;
  checks := checks || jsonb_build_object('code', 'rent', 'area', 'P&L review', 'title', 'Rent and premises posted',
    'status', case when cur <= 0 then 'fail' when avg3 > 0 and cur < 0.5 * avg3 then 'warn' else 'pass' end,
    'amount', round(cur, 2), 'detail', 'Premises cost ' || to_char(round(cur), 'FM$999,999,990') || ' against a three-month average of ' || to_char(round(coalesce(avg3, 0)), 'FM$999,999,990') || '.',
    'action', 'Post the rent invoice or accrual (3RN).');
  cur := (leaks->'revenue'->>'cur')::numeric; avg3 := (leaks->'revenue'->>'avg')::numeric;
  checks := checks || jsonb_build_object('code', 'revenue', 'area', 'P&L review', 'title', 'Revenue in line with recent months',
    'status', case when avg3 > 0 and abs(cur - avg3) > 0.3 * avg3 then 'warn' else 'pass' end,
    'amount', round(cur, 2), 'detail', 'Revenue ' || to_char(round(cur), 'FM$999,999,990') || ' against a three-month average of ' || to_char(round(coalesce(avg3, 0)), 'FM$999,999,990') || '.',
    'action', 'Explain large swings: missing invoices, cut-off, or real volume change.', 'view', 'pl');

  -- 15 depreciation
  select count(*) into n from finance.gl_trans t join finance.v_accounts a on a.account = t.account
  where t.company = '01' and a.pl_line = 'Depreciation' and t.period between finance.fy_of(m0)::text || '01' and p;
  checks := checks || jsonb_build_object('code', 'depreciation', 'area', 'P&L review', 'title', 'Depreciation posted',
    'status', case when n > 0 then 'pass' else 'warn' end,
    'detail', case when n > 0 then 'Depreciation is posted this year.' else 'No depreciation posted this year. Profit is overstated by the annual charge.' end,
    'action', 'Post monthly depreciation, or note it is done at year end.');

  -- 16 data covers the month
  t := (select max(docdate)::text from finance.gl_trans where docdate <= current_date);
  checks := checks || jsonb_build_object('code', 'sync', 'area', 'Data', 'title', 'Portal data covers month end',
    'status', case when t::date >= e + 3 then 'pass' when t::date >= e then 'warn' else 'fail' end,
    'detail', 'Ledger synced to ' || to_char(t::date, 'DD Mon YYYY') || case when t::date < e + 3 then '. Re-run sync_finance.py after the month is closed in TradeWindow.' else '.' end);

  -- merge reviews and sign-off
  return jsonb_build_object(
    'month', m0, 'month_end', e,
    'checks', (select jsonb_agg(c || jsonb_build_object('review', (
        select jsonb_build_object('status', rv.status, 'note', rv.note, 'by', finance.user_label(rv.reviewed_by), 'at', rv.reviewed_at)
        from finance.close_reviews rv where rv.month = m0 and rv.code = c->>'code' and rv.status <> 'open')))
      from jsonb_array_elements(checks) c),
    'signoff', (select jsonb_build_object('closed', cm.closed, 'note', cm.note, 'by', finance.user_label(cm.closed_by), 'at', cm.closed_at)
      from finance.close_months cm where cm.month = m0 and cm.closed));
end $$;

create or replace function public.fin_close_review(p_month date, p_code text, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = finance, public as $$
begin
  perform finance.assert_access();
  if p_status not in ('open', 'done', 'accepted') then raise exception 'bad status'; end if;
  if p_status = 'accepted' and coalesce(trim(p_note), '') = '' then raise exception 'Add a note to accept an exception'; end if;
  insert into finance.close_reviews (month, code, status, note, reviewed_by)
  values (date_trunc('month', p_month)::date, p_code, p_status, nullif(trim(p_note), ''), auth.uid())
  on conflict (month, code) do update set status = excluded.status, note = excluded.note,
    reviewed_by = excluded.reviewed_by, reviewed_at = now();
end $$;

-- Sign off (p_close true) or reopen a month. Signing off needs every failed check done or accepted.
create or replace function public.fin_close_month(p_month date, p_close boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = finance, public as $$
declare m0 date := date_trunc('month', p_month)::date; cl jsonb; open_fails int;
begin
  perform finance.assert_access();
  if p_close then
    cl := public.fin_close_checklist(m0);
    select count(*) into open_fails from jsonb_array_elements(cl->'checks') c
    where c->>'status' = 'fail' and (c->'review' is null or c->'review' = 'null'::jsonb);
    if open_fails > 0 then raise exception '% failed checks still open. Fix them or accept them with a note first.', open_fails; end if;
  end if;
  insert into finance.close_months (month, closed, note, summary, closed_by, closed_at)
  values (m0, p_close, nullif(trim(p_note), ''), cl, auth.uid(), now())
  on conflict (month) do update set closed = excluded.closed, note = excluded.note,
    summary = coalesce(excluded.summary, finance.close_months.summary), closed_by = excluded.closed_by, closed_at = now();
  return public.fin_close_checklist(m0);
end $$;

revoke all on function public.fin_close_checklist(date) from public, anon;
revoke all on function public.fin_close_review(date, text, text, text) from public, anon;
revoke all on function public.fin_close_month(date, boolean, text) from public, anon;
revoke all on function finance.user_label(uuid) from public, anon, authenticated;
grant execute on function public.fin_close_checklist(date) to authenticated;
grant execute on function public.fin_close_review(date, text, text, text) to authenticated;
grant execute on function public.fin_close_month(date, boolean, text) to authenticated;
notify pgrst, 'reload schema';

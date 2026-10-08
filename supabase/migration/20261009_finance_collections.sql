-- REPO PARITY ONLY. Applied to Supabase via MCP on 2026-10-09. DO NOT RE-RUN.
-- Collections workspace + payment matching (Reports > Finance > Collections / Match payments).

-- Collections workspace + payment matching. Idempotent. Access: has_perm('finance','read').

create table if not exists finance.settings (key text primary key, value text, updated_at timestamptz default now());
insert into finance.settings (key, value) values ('collections_mailbox', 'accounts.nz@ubfreight.com')
on conflict (key) do nothing;

create table if not exists finance.collection_actions (
  id bigint generated always as identity primary key,
  accountid text not null,
  kind text not null check (kind in ('note', 'call', 'promise', 'email', 'dispute', 'hold')),
  body text,
  promise_date date,
  promise_amount numeric,
  invoices text[],
  email_to text[],
  created_by uuid default auth.uid(),
  created_at timestamptz default now());
create index if not exists coll_actions_acct on finance.collection_actions (accountid, created_at desc);

create table if not exists finance.match_reviews (
  receipt_id bigint primary key,
  status text not null check (status in ('done', 'ignore')),
  note text,
  balance_at_review numeric,
  reviewed_by uuid default auth.uid(),
  reviewed_at timestamptz default now());

revoke all on all tables in schema finance from public, anon, authenticated;

-- best email per customer: accounts-looking contact first, then prime contact, then customer email
create or replace view finance.v_customer_emails as
select c.account_id as accountid,
  array_remove(array_agg(distinct lower(e.email)) filter (where e.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'), null) as emails,
  (array_agg(lower(e.email) order by e.rank, e.email))[1] as best
from public.customers c
cross join lateral (
  select c.email, 3 as rank
  union all
  select ct.email,
    case when ct.email ~* '(account|payable|^ap[@.]|finance|invoice)' then 1 when ct.is_prime then 2 else 4 end
  from public.contacts ct where ct.account_id = c.account_id
) e
where e.email is not null and e.email <> ''
group by c.account_id;

create or replace function public.fin_collections_queue()
returns table (accountid text, name text, email text, terms text, credit_limit numeric, is_related boolean,
  overdue numeric, d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, total numeric,
  unapplied numeric, oldest_days int, avg_days_late numeric, stage text, priority numeric,
  last_kind text, last_at timestamptz, last_by text, promise_date date, promise_amount numeric, promise_broken boolean)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  with ag as (select * from public.fin_aging('D')),
  last_a as (
    select distinct on (a.accountid) a.accountid, a.kind, a.created_at, a.created_by
    from finance.collection_actions a order by a.accountid, a.created_at desc
  ), prom as (
    select distinct on (a.accountid) a.accountid, a.promise_date, a.promise_amount, a.created_at
    from finance.collection_actions a where a.kind = 'promise' order by a.accountid, a.created_at desc
  )
  select g.accountid, coalesce(g.name, cu.name), ce.best, g.terms, g.credit_limit, g.is_related,
    g.d1_30 + g.d31_60 + g.d61_90 + g.d90_plus, g.d1_30, g.d31_60, g.d61_90, g.d90_plus, g.total, g.unapplied,
    case when g.oldest_due is null then 0 else greatest(0, current_date - g.oldest_due) end,
    g.avg_days_late,
    case when g.d61_90 + g.d90_plus > 0 then 'final' when g.d31_60 > 0 then 'firm' else 'friendly' end,
    round((g.d1_30 * 1 + g.d31_60 * 2 + g.d61_90 * 3 + g.d90_plus * 4)
      * case when p.promise_date < current_date and p.created_at > now() - interval '60 days' then 1.5 else 1 end, 0),
    la.kind, la.created_at, su.full_name, p.promise_date, p.promise_amount,
    coalesce(p.promise_date < current_date and p.created_at > now() - interval '60 days', false)
  from ag g
  left join public.customers cu on cu.account_id = g.accountid
  left join finance.v_customer_emails ce on ce.accountid = g.accountid
  left join last_a la on la.accountid = g.accountid
  left join prom p on p.accountid = g.accountid
  left join public.staff_users su on su.user_id = la.created_by
  where g.d1_30 + g.d31_60 + g.d61_90 + g.d90_plus > 1;
end $$;

create or replace function public.fin_customer_ledger(p_accountid text)
returns jsonb
language plpgsql stable security definer set search_path = finance, public as $$
declare v jsonb;
begin
  perform finance.assert_access();
  select jsonb_build_object(
    'accountid', p_accountid,
    'name', coalesce((select name from finance.parties where accountid = p_accountid),
                     (select name from public.customers where account_id = p_accountid)),
    'emails', coalesce((select to_jsonb(emails) from finance.v_customer_emails where accountid = p_accountid), '[]'::jsonb),
    'best_email', (select best from finance.v_customer_emails where accountid = p_accountid),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object(
        'number', i.number, 'doctype', i.doctype, 'module', i.module, 'job_no', i.job_no, 'doc_date', i.doc_date,
        'datedue', i.datedue, 'days_over', current_date - coalesce(i.datedue, i.doc_date),
        'amount', i.amt_local, 'balance', i.balance, 'currency', i.curr_name) order by coalesce(i.datedue, i.doc_date))
      from finance.ledger_invoices i
      where i.company = '01' and i.d_c_flag = 'D' and i.accountid = p_accountid and abs(coalesce(i.balance, 0)) >= 0.01), '[]'::jsonb),
    'unapplied', coalesce((select jsonb_agg(jsonb_build_object('receipt_no', r.receipt_no, 'date', r.date1, 'ref', r.cheque,
        'amount', r.amount, 'balance', r.balance) order by r.date1)
      from finance.receipts r where r.company = '01' and r.d_c_flag = 'D' and r.accountid = p_accountid
        and abs(coalesce(r.balance, 0)) >= 0.01), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'body', a.body,
        'promise_date', a.promise_date, 'promise_amount', a.promise_amount, 'invoices', a.invoices, 'email_to', a.email_to,
        'at', a.created_at, 'by', su.full_name) order by a.created_at desc)
      from finance.collection_actions a left join public.staff_users su on su.user_id = a.created_by
      where a.accountid = p_accountid), '[]'::jsonb),
    'mailbox', (select value from finance.settings where key = 'collections_mailbox')
  ) into v;
  return v;
end $$;

create or replace function public.fin_collection_log(p_accountid text, p_kind text, p_body text default null,
  p_promise_date date default null, p_promise_amount numeric default null, p_invoices text[] default null,
  p_email_to text[] default null)
returns bigint
language plpgsql security definer set search_path = finance, public as $$
declare v_id bigint;
begin
  perform finance.assert_access();
  if coalesce(trim(p_accountid), '') = '' then raise exception 'account required'; end if;
  if p_kind = 'promise' and p_promise_date is null then raise exception 'promise date required'; end if;
  insert into finance.collection_actions (accountid, kind, body, promise_date, promise_amount, invoices, email_to, created_by)
  values (p_accountid, p_kind, nullif(trim(p_body), ''), p_promise_date, p_promise_amount, p_invoices, p_email_to, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Suggested allocation for every unapplied customer receipt
create or replace function public.fin_unapplied_matches()
returns table (receipt_id bigint, receipt_no bigint, accountid text, name text, date1 date, ref text,
  amount numeric, balance numeric, age_days int, rule text, confidence text, suggestion text,
  invoices jsonb, review_status text, review_note text)
language plpgsql stable security definer set search_path = finance, public as $$
#variable_conflict use_column
begin
  perform finance.assert_access();
  return query
  with r as (
    select x.* from finance.receipts x
    where x.company = '01' and x.d_c_flag = 'D' and x.balance >= 0.01
  ), inv as (
    select i.accountid, i.number, i.balance, coalesce(i.datedue, i.doc_date) as due, i.doc_date
    from finance.ledger_invoices i
    where i.company = '01' and i.d_c_flag = 'D' and i.balance >= 0.01
  ), oldest as (  -- running total of open invoices, oldest first
    select inv.*, sum(inv.balance) over (partition by inv.accountid order by inv.due, inv.number) as run
    from inv
  ), m as (
    select r.id,
      (select jsonb_build_object('rule', 'exact_invoice', 'conf', 'high', 'inv', jsonb_agg(jsonb_build_object('number', i.number, 'balance', i.balance)))
         from (select * from inv where inv.accountid = r.accountid and abs(inv.balance - r.balance) < 0.01 order by inv.due limit 1) i
         having count(*) > 0) as m1,
      (select jsonb_build_object('rule', 'oldest_first_exact', 'conf', 'high', 'inv', jsonb_agg(jsonb_build_object('number', o.number, 'balance', o.balance) order by o.due))
         from oldest o where o.accountid = r.accountid and o.run <= r.balance + 0.01
         having abs(sum(o.balance) - r.balance) < 0.01 and count(*) > 1) as m2,
      (select jsonb_build_object('rule', 'reference', 'conf', 'medium', 'inv', jsonb_agg(jsonb_build_object('number', i.number, 'balance', i.balance)))
         from inv i where i.accountid = r.accountid and length(i.number) >= 4
           and coalesce(r.cheque, '') || ' ' || coalesce(r.reason, '') ~ ('(^|[^0-9])' || regexp_replace(i.number, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '([^0-9]|$)')
         having count(*) > 0) as m3,
      (select jsonb_build_object('rule', 'other_account', 'conf', 'medium', 'inv', jsonb_agg(jsonb_build_object('number', i.number, 'balance', i.balance, 'accountid', i.accountid)))
         from (select * from inv where r.balance >= 100 and inv.accountid <> r.accountid and abs(inv.balance - r.balance) < 0.01 limit 3) i
         having count(*) > 0) as m4,
      (select jsonb_build_object('rule', 'oldest_first_partial', 'conf', 'low', 'inv', jsonb_agg(jsonb_build_object('number', o.number, 'balance', o.balance) order by o.due))
         from oldest o where o.accountid = r.accountid and o.run - o.balance < r.balance
         having count(*) > 0) as m5
    from r
  ), pick as (
    select m.id, coalesce(m.m1, m.m2, m.m3, m.m4, m.m5,
      jsonb_build_object('rule', 'no_open_invoices', 'conf', 'none', 'inv', '[]'::jsonb)) as p
    from m
  )
  select r.id, r.receipt_no, r.accountid, coalesce(pa.name, cu.name), r.date1, r.cheque, r.amount, r.balance,
    current_date - r.date1,
    p.p->>'rule', p.p->>'conf',
    case p.p->>'rule'
      when 'exact_invoice' then 'Allocate to the open invoice with the same amount'
      when 'oldest_first_exact' then 'Allocate oldest-first: these invoices add up exactly'
      when 'reference' then 'Payment reference quotes these invoice numbers'
      when 'other_account' then 'Same amount is open on another account: receipt may be posted to the wrong customer'
      when 'oldest_first_partial' then 'No exact match. Allocate oldest-first; the last invoice stays part-paid'
      else 'Customer has no open invoices: refund, move to another account, or hold as credit' end,
    p.p->'inv', mr.status, mr.note
  from r join pick p on p.id = r.id
  left join finance.parties pa on pa.accountid = r.accountid
  left join public.customers cu on cu.account_id = r.accountid
  left join finance.match_reviews mr on mr.receipt_id = r.id and abs(coalesce(mr.balance_at_review, 0) - r.balance) < 0.01;
end $$;

create or replace function public.fin_match_review(p_receipt_id bigint, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = finance, public as $$
begin
  perform finance.assert_access();
  if p_status not in ('done', 'ignore', 'clear') then raise exception 'bad status'; end if;
  if p_status = 'clear' then
    update finance.match_reviews set status = 'ignore', balance_at_review = -1 where receipt_id = p_receipt_id;
    return;
  end if;
  insert into finance.match_reviews (receipt_id, status, note, balance_at_review, reviewed_by)
  values (p_receipt_id, p_status, nullif(trim(p_note), ''),
          (select balance from finance.receipts where id = p_receipt_id), auth.uid())
  on conflict (receipt_id) do update set status = excluded.status, note = excluded.note,
    balance_at_review = excluded.balance_at_review, reviewed_by = excluded.reviewed_by, reviewed_at = now();
end $$;

create or replace function public.fin_setting_set(p_key text, p_value text)
returns void
language plpgsql security definer set search_path = finance, public as $$
begin
  perform finance.assert_access();
  if p_key not in ('collections_mailbox') then raise exception 'unknown setting'; end if;
  insert into finance.settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

revoke all on function public.fin_collections_queue() from public, anon;
revoke all on function public.fin_customer_ledger(text) from public, anon;
revoke all on function public.fin_collection_log(text, text, text, date, numeric, text[], text[]) from public, anon;
revoke all on function public.fin_unapplied_matches() from public, anon;
revoke all on function public.fin_match_review(bigint, text, text) from public, anon;
revoke all on function public.fin_setting_set(text, text) from public, anon;
grant execute on function public.fin_collections_queue() to authenticated;
grant execute on function public.fin_customer_ledger(text) to authenticated;
grant execute on function public.fin_collection_log(text, text, text, date, numeric, text[], text[]) to authenticated;
grant execute on function public.fin_unapplied_matches() to authenticated;
grant execute on function public.fin_match_review(bigint, text, text) to authenticated;
grant execute on function public.fin_setting_set(text, text) to authenticated;

notify pgrst, 'reload schema';

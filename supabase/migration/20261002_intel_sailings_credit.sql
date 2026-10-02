-- Freight Intelligence: sailing pattern + customer credit snapshot.
-- Staff only. Idempotent. Run once in Supabase SQL editor.

create or replace function public.lane_sailings(p_origin text, p_dest text, p_mode text)
returns jsonb
language sql stable security definer set search_path = public
as $fn$
with v as (
  select upper(trim(s.vessel_flight)) as voyage,
         mode() within group (order by s.etd) as etd,
         count(*)::int as jobs
  from shipments s
  where s.origin = p_origin and s.destination = p_dest and s.mode ilike p_mode
    and s.vessel_flight is not null and trim(s.vessel_flight) <> ''
    and s.etd between current_date - 150 and current_date + 60
  group by 1
),
past as (select etd, lag(etd) over (order by etd) prev from (select distinct etd from v where etd < current_date) d),
gap as (select percentile_cont(.5) within group (order by etd - prev)::int g from past where prev is not null and etd - prev > 0)
select jsonb_build_object(
  'last_etd', (select max(etd) from v where etd < current_date),
  'gap_days', (select g from gap),
  'departures_90d', (select count(distinct etd) from v where etd between current_date - 90 and current_date - 1),
  'upcoming', coalesce((select jsonb_agg(jsonb_build_object('voyage', voyage, 'etd', etd, 'jobs', jobs) order by etd)
                        from (select * from v where etd >= current_date order by etd limit 3) u), '[]'::jsonb)
)
where is_staff();
$fn$;

create or replace function public.customer_credit_snapshot(p_account text)
returns jsonb
language sql stable security definer set search_path = public
as $fn$
with i as (
  select balance, date_due from invoices
  where account_id = p_account and coalesce(balance, 0) > 0.5
)
select jsonb_build_object(
  'outstanding', round(coalesce((select sum(balance) from i), 0), 0),
  'overdue', round(coalesce((select sum(balance) from i where date_due < current_date), 0), 0),
  'overdue_60', round(coalesce((select sum(balance) from i where date_due < current_date - 60), 0), 0),
  'oldest_days', (select max(current_date - date_due) from i where date_due < current_date),
  'invoices_overdue', (select count(*) from i where date_due < current_date),
  'credit_limit', (select credit_limit from customers where account_id = p_account),
  'terms', (select account_terms from customers where account_id = p_account)
)
where is_staff() and p_account is not null;
$fn$;

revoke all on function public.lane_sailings(text,text,text) from public, anon;
revoke all on function public.customer_credit_snapshot(text) from public, anon;
grant execute on function public.lane_sailings(text,text,text) to authenticated;
grant execute on function public.customer_credit_snapshot(text) to authenticated;

notify pgrst, 'reload schema';

-- 20260929_portal_analytics_fn.sql
-- One call for the portal dashboard analytics. Runs as the caller, so it only sees
-- the caller's rows through the portal_* views (my_account_id, active users only).
create or replace function public.portal_analytics()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with bounds as (
  select (date_trunc('month', current_date) - interval '11 months')::date as start_m
),
months as (
  select generate_series((select start_m from bounds), date_trunc('month', current_date)::date, interval '1 month')::date as m
),
s as (
  select * from portal_shipments where doc_date >= (select start_m from bounds)
),
ship_m as (
  select to_char(m.m, 'YYYY-MM') as month,
         count(s.job_unique) filter (where lower(s.mode) = 'sea') as sea,
         count(s.job_unique) filter (where lower(s.mode) = 'air') as air,
         coalesce(round(sum(s.weight_kg)::numeric), 0) as kg,
         coalesce(round(sum(s.volume_m3)::numeric, 1), 0) as cbm
    from months m
    left join s on date_trunc('month', s.doc_date)::date = m.m
   group by m.m order by m.m
),
inv_m as (
  select to_char(m.m, 'YYYY-MM') as month, coalesce(round(sum(i.amt_local)::numeric, 2), 0) as spend
    from months m
    left join portal_invoices i on date_trunc('month', i.doc_date)::date = m.m
   group by m.m order by m.m
),
lanes as (
  select origin, destination, lower(mode) as mode, count(*) as n,
         coalesce(round(sum(weight_kg)::numeric), 0) as kg,
         round(avg(case when arrived is not null and departed is not null then arrived::date - departed::date end)::numeric, 1) as transit_days,
         round(avg(case when eta is not null and etd is not null and eta >= etd then eta - etd end)::numeric, 1) as sched_days
    from s
   where origin is not null and destination is not null
   group by 1, 2, 3
   order by n desc
   limit 12
),
ontime as (
  select count(*) as n,
         count(*) filter (where arrived::date <= eta + 1) as on_time
    from portal_shipments
   where arrived is not null and eta is not null and arrived >= current_date - 365
),
boxes as (
  select count(*) as containers,
         coalesce(sum(case when c.container_size ilike '4%' then 2 else 1 end), 0) as teu
    from portal_containers c
   where exists (select 1 from s where s.consol_key = c.consol_key and lower(s.mode) = 'sea')
)
select jsonb_build_object(
  'months', (select jsonb_agg(jsonb_build_object('month', a.month, 'sea', a.sea, 'air', a.air, 'kg', a.kg, 'cbm', a.cbm, 'spend', b.spend) order by a.month)
               from ship_m a join inv_m b using (month)),
  'lanes', coalesce((select jsonb_agg(to_jsonb(lanes)) from lanes), '[]'::jsonb),
  'totals', jsonb_build_object(
      'shipments', (select count(*) from s),
      'kg', (select coalesce(round(sum(weight_kg)::numeric), 0) from s),
      'cbm', (select coalesce(round(sum(volume_m3)::numeric, 1), 0) from s),
      'spend', (select coalesce(round(sum(amt_local)::numeric, 2), 0) from portal_invoices where doc_date >= (select start_m from bounds)),
      'containers', (select containers from boxes),
      'teu', (select teu from boxes)),
  'ontime', (select jsonb_build_object('n', n, 'on_time', on_time) from ontime)
);
$$;

revoke all on function public.portal_analytics() from public, anon;
grant execute on function public.portal_analytics() to authenticated;

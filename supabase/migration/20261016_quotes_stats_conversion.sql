-- Quotes stats: add conversion (quoted -> won) and booked (quoted -> booking) rates.
-- Both are cohort rates: quotes created in the period, measured by outcome today.
drop function if exists public.quotes_stats(text, text, text, text);

create function public.quotes_stats(p_mode text default 'all', p_from text default null, p_to text default null, p_period text default 'month')
returns table(period_count integer, open integer, needs_pricing integer, won_period integer, lost_period integer,
              win_rate numeric, conversion_rate numeric, booked_period integer, booked_rate numeric)
language sql stable set search_path to 'public'
as $function$
  with b as (
    select (date_trunc(case when p_period in ('week','month','quarter','year') then p_period else 'month' end,
            now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland') as since
  ), q as (
    select x.id, x.status, x.created_at, x.updated_at, x.booking_id
    from quotes x
    where (coalesce(p_mode,'all') = 'all'
        or (p_mode = 'air' and (x.shipment_type ilike 'air' or x.shipment_mode ilike '%air%'))
        or (p_mode = 'fcl' and x.shipment_type ilike 'fcl')
        or (p_mode = 'lcl' and x.shipment_type ilike 'lcl'))
      and (p_from is null or x.from_port_code = upper(p_from))
      and (p_to is null or x.to_port_code = upper(p_to))
  )
  select
    count(q.id) filter (where q.created_at >= b.since)::int,
    count(q.id) filter (where q.status = 'open')::int,
    count(q.id) filter (where q.status = 'open' and not exists (select 1 from quote_responses r where r.quote_id = q.id))::int,
    count(q.id) filter (where q.status in ('won','crosswin') and q.updated_at >= b.since)::int,
    count(q.id) filter (where q.status = 'lost' and q.updated_at >= b.since)::int,
    round(100.0 * count(q.id) filter (where q.status in ('won','crosswin') and q.updated_at >= b.since)
      / nullif(count(q.id) filter (where q.status in ('won','crosswin','lost') and q.updated_at >= b.since), 0), 0),
    round(100.0 * count(q.id) filter (where q.created_at >= b.since and q.status in ('won','crosswin'))
      / nullif(count(q.id) filter (where q.created_at >= b.since), 0), 0),
    count(q.id) filter (where q.created_at >= b.since and q.booking_id is not null)::int,
    round(100.0 * count(q.id) filter (where q.created_at >= b.since and q.booking_id is not null)
      / nullif(count(q.id) filter (where q.created_at >= b.since), 0), 0)
  from b left join q on true
  group by b.since;
$function$;

revoke all on function public.quotes_stats(text, text, text, text) from public, anon;
grant execute on function public.quotes_stats(text, text, text, text) to authenticated;

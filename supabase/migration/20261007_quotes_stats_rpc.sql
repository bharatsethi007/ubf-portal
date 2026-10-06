-- Quotes page stats strip + port pair filter options. Applied via MCP 7 Oct 2026.
create or replace function public.quotes_stats(p_mode text default 'all', p_from text default null, p_to text default null)
returns table(this_month int, open int, needs_pricing int, won_month int, lost_month int, win_rate_90d numeric)
language sql stable security invoker set search_path = public as $$
  with q as (
    select x.id, x.status, x.created_at, x.updated_at
    from quotes x
    where (coalesce(p_mode,'all') = 'all'
        or (p_mode = 'air' and (x.shipment_type ilike 'air' or x.shipment_mode ilike '%air%'))
        or (p_mode = 'fcl' and x.shipment_type ilike 'fcl')
        or (p_mode = 'lcl' and x.shipment_type ilike 'lcl'))
      and (p_from is null or x.from_port_code = upper(p_from))
      and (p_to is null or x.to_port_code = upper(p_to))
  )
  select
    count(*) filter (where created_at >= date_trunc('month', now()))::int,
    count(*) filter (where status = 'open')::int,
    count(*) filter (where status = 'open' and not exists (select 1 from quote_responses r where r.quote_id = q.id))::int,
    count(*) filter (where status in ('won','crosswin') and updated_at >= date_trunc('month', now()))::int,
    count(*) filter (where status = 'lost' and updated_at >= date_trunc('month', now()))::int,
    round(100.0 * count(*) filter (where status in ('won','crosswin') and created_at >= now() - interval '90 days')
      / nullif(count(*) filter (where status in ('won','crosswin','lost') and created_at >= now() - interval '90 days'), 0), 0)
  from q;
$$;
grant execute on function public.quotes_stats(text,text,text) to authenticated;

create or replace function public.quotes_port_codes()
returns table(side text, code text, n int)
language sql stable security invoker set search_path = public as $$
  select 'from', upper(from_port_code), count(*)::int from quotes where from_port_code is not null group by 2
  union all
  select 'to', upper(to_port_code), count(*)::int from quotes where to_port_code is not null group by 2
  order by 1, 3 desc, 2;
$$;
grant execute on function public.quotes_port_codes() to authenticated;

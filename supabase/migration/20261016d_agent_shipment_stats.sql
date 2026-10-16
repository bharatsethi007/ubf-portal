-- Agent shipments tab stats (16 Oct 2026). Applied via MCP; kept here for repo parity.
create or replace function public.agent_shipment_stats(p_code text)
returns jsonb language sql stable set search_path to 'public' as $$
  with s as (select * from shipments where os_agent_code = p_code),
  y as (select * from s where coalesce(etd, relevant_date) >= current_date - 365)
  select jsonb_build_object(
    'total', (select count(*) from s),
    'last_12m', (select count(*) from y),
    'in_transit', (select count(*) from s where status = 'In transit'),
    'upcoming', (select count(*) from s where status in ('Booked','Scheduled')),
    'imports', (select count(*) from y where direction = 'import'),
    'exports', (select count(*) from y where direction = 'export'),
    'air', (select count(*) from y where mode = 'air'),
    'sea', (select count(*) from y where mode = 'sea'),
    'fcl', (select count(*) from y where mode = 'sea' and load_type ilike 'fcl%'),
    'lcl', (select count(*) from y where mode = 'sea' and load_type ilike 'lcl%'),
    'weight_kg', (select round(sum(coalesce(weight_kg, 0))) from y),
    'volume_m3', (select round(sum(coalesce(volume_m3, 0))::numeric, 1) from y),
    'gp', (select round(sum(f.gross_profit)) from y join reporting.mv_job_financials f on f.job_unique = y.job_unique),
    'revenue', (select round(sum(f.revenue)) from y join reporting.mv_job_financials f on f.job_unique = y.job_unique),
    'last_shipment', (select max(coalesce(etd, relevant_date)) from s),
    'lanes', coalesce((select jsonb_agg(x order by x.n desc) from (
       select origin || ' > ' || destination lane, count(*) n from y
       where origin is not null and destination is not null group by 1 order by 2 desc limit 3) x), '[]'::jsonb)
  )
$$;
grant execute on function public.agent_shipment_stats(text) to authenticated;

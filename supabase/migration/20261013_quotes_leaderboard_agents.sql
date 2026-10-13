-- Quotes leaderboard: Agents report + time-to-quote fix. 13 Oct 2026. Parity file, do not re-run.
-- Time to quote = quote created -> LAST rate line added (quote_response_lines), median.
-- Old timer stopped at the empty response shell (seconds after create), so every row showed 1m.
-- Median, not avg: re-quotes edited days later skew the average (Oct: avg 3.9h, median 8m).

-- 1. Patch live quotes_leaderboard in place (keeps every other part of the live definition).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.quotes_leaderboard(text,text)'::regprocedure);
  if position('quote_response_lines' in d) > 0 then
    raise notice 'quotes_leaderboard already patched';
    return;
  end if;
  d := replace(d,
    '(select min(r.created_at) from quote_responses r where r.quote_id = x.id) as first_resp',
    '(select max(l.created_at) from quote_responses r join quote_response_lines l on l.response_id = r.id where r.quote_id = x.id) as first_resp');
  d := regexp_replace(d,
    'avg\((extract\(epoch from (q\.)?first_resp - (q\.)?(created_at|received_at)\) / 3600\.0)\)',
    '(percentile_cont(0.5) within group (order by \1))', 'g');
  if position('quote_response_lines' in d) = 0 or position('percentile_cont' in d) = 0 then
    raise exception 'quotes_leaderboard patch pattern not found';
  end if;
  execute d;
end $$;

-- 2. Agents report. Agent quote = quotes.agent_id, OR customer account is an agent
--    (agents.erp_account_code), OR free-text agent_name filled. Same period/mode rules.
drop function if exists public.quotes_leaderboard_agents(text, text);
create function public.quotes_leaderboard_agents(p_period text default 'month', p_mode text default 'all')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_since timestamptz;
  v_out jsonb;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  v_since := date_trunc(case when p_period in ('week','month','quarter','year') then p_period else 'month' end,
             now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';

  with q as (
    select x.id, x.status, x.created_at,
           coalesce(a.id, ac.id) as agent_id,
           coalesce(a.name, ac.name, nullif(trim(x.agent_name), ''), x.customer_name, 'Unknown') as agent_name,
           upper(coalesce(a.country, ac.country, '')) as country,
           upper(coalesce(nullif(x.from_port_code, ''), '?')) as origin_code,
           upper(coalesce(nullif(x.to_port_code, ''), '?')) as dest_code,
           (select max(l.created_at) from quote_responses r join quote_response_lines l on l.response_id = r.id
             where r.quote_id = x.id) as rates_done
    from quotes x
    left join agents a on a.id = x.agent_id
    left join lateral (select a2.id, a2.name, a2.country from agents a2
                       where x.agent_id is null and a2.erp_account_code = x.customer_account_id limit 1) ac on true
    where x.created_at >= v_since
      and (a.id is not null or ac.id is not null or nullif(trim(x.agent_name), '') is not null)
      and (coalesce(p_mode,'all') = 'all'
        or (p_mode = 'air' and (x.shipment_type ilike 'air' or x.shipment_mode ilike '%air%'))
        or (p_mode = 'fcl' and x.shipment_type ilike 'fcl')
        or (p_mode = 'lcl' and x.shipment_type ilike 'lcl'))
  ), ql as (
    select q.*,
           coalesce((select upper(p.country_code) from ports p where p.code = q.origin_code limit 1), '??') as o_cc,
           coalesce((select upper(p.country_code) from ports p where p.code = q.dest_code limit 1), '??') as d_cc
    from q
  ), g as (
    select coalesce(agent_id::text, 'n:' || lower(agent_name)) as k,
      max(agent_id::text) as agent_id,
      min(agent_name) as name,
      max(nullif(country, '')) as country,
      count(*)::int as quotes,
      count(*) filter (where status = 'open')::int as open,
      count(*) filter (where status in ('won','crosswin'))::int as won,
      count(*) filter (where status = 'lost')::int as lost,
      round(100.0 * count(*) filter (where status in ('won','crosswin'))
        / nullif(count(*) filter (where status in ('won','crosswin','lost')), 0), 0) as win_rate,
      round((percentile_cont(0.5) within group (order by extract(epoch from rates_done - created_at) / 3600.0))::numeric, 1) as avg_hrs_to_quote,
      mode() within group (order by o_cc || '>' || d_cc) as top_lane,
      max(created_at) as last_quote
    from ql group by 1
  )
  select coalesce(jsonb_agg(to_jsonb(g) - 'k' order by g.quotes desc, g.won desc), '[]'::jsonb)
    into v_out from g;
  return v_out;
end $$;

revoke all on function public.quotes_leaderboard_agents(text, text) from public, anon;
grant execute on function public.quotes_leaderboard_agents(text, text) to authenticated;

notify pgrst, 'reload schema';

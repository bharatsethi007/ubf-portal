-- Agent booking stats (16 Oct 2026).
-- Free hand from agent = import jobs where the agent is the overseas agent (they give us).
-- Booked with agent    = export jobs where the agent is the overseas agent (we give them).
-- Source: shipment_legs, last 12 months by ETD (else doc date). GP from reporting.mv_job_financials.
-- Note: air import legs carry no overseas agent code in the ERP, so air free hand is not counted yet.

create or replace view public.v_agent_bookings_12m with (security_invoker = true) as
select a.id as agent_id,
  count(*) filter (where l.direction = 'import')::int as freehand,
  count(*) filter (where l.direction = 'export')::int as booked,
  round(sum(coalesce(l.weight_kg, 0)) filter (where l.direction = 'import')) as freehand_kg,
  round(sum(coalesce(l.weight_kg, 0)) filter (where l.direction = 'export')) as booked_kg,
  round(sum(f.gross_profit) filter (where l.direction = 'import')) as freehand_gp,
  round(sum(f.gross_profit) filter (where l.direction = 'export')) as booked_gp
from public.agents a
join public.shipment_legs l on l.os_agent_code = a.erp_account_code
left join reporting.mv_job_financials f on f.job_unique = l.job_unique
where coalesce(l.etd, l.doc_date) >= current_date - 365
group by a.id;

create or replace view public.v_agents_directory as
 select a.id, a.erp_account_code, a.name, a.country, a.source, a.status, a.trusted, a.approved_by,
    a.approved_at, a.notes, a.created_at, a.updated_at, la.last_activity,
    coalesce(la.job_count, 0::bigint) as job_count,
    coalesce(qs.quotes, 0) as quotes_12m,
    coalesce(qs.won, 0) as won_12m,
    coalesce(qs.lost, 0) as lost_12m,
    qs.hrs_to_win,
    qs.top_lane,
    qs.last_quote,
    coalesce(st.state, 'none') as agreement_state,
    st.expiry_date as agreement_expiry,
    st.days_left as agreement_days_left,
    coalesce(bk.freehand, 0) as freehand_12m,
    coalesce(bk.booked, 0) as booked_12m
   from agents a
     left join lateral ( select max(s.relevant_date) as last_activity, count(*) as job_count
           from shipments s where s.os_agent_code = a.erp_account_code) la on true
     left join lateral ( select count(*)::int as quotes,
            count(*) filter (where q.status in ('won','crosswin'))::int as won,
            count(*) filter (where q.status = 'lost')::int as lost,
            round((percentile_cont(0.5) within group (order by extract(epoch from q.won_at - q.created_at) / 3600.0)
              filter (where q.won_at is not null))::numeric, 1) as hrs_to_win,
            mode() within group (order by coalesce(q.from_port_code,'?') || ' > ' || coalesce(q.to_port_code,'?')) as top_lane,
            max(q.created_at) as last_quote
           from v_agent_quotes q where q.for_agent_id = a.id and q.created_at >= now() - interval '12 months') qs on true
     left join v_agent_agreement_state st on st.agent_id = a.id
     left join v_agent_bookings_12m bk on bk.agent_id = a.id;

-- Wrap the overview and stats RPCs: same output plus booking keys.
create or replace function public.agents_bookings_overview()
returns jsonb language sql stable set search_path to 'public' as $$
  select jsonb_build_object(
    'freehand', coalesce(sum(freehand), 0), 'booked', coalesce(sum(booked), 0),
    'freehand_gp', coalesce(sum(freehand_gp), 0), 'booked_gp', coalesce(sum(booked_gp), 0),
    'freehand_agents', count(*) filter (where freehand > 0), 'booked_agents', count(*) filter (where booked > 0),
    'two_way_agents', count(*) filter (where freehand > 0 and booked > 0))
  from v_agent_bookings_12m
$$;

create or replace function public.agent_bookings(p_agent uuid)
returns jsonb language sql stable set search_path to 'public' as $$
  select coalesce((select to_jsonb(b) - 'agent_id' from v_agent_bookings_12m b where b.agent_id = p_agent),
    jsonb_build_object('freehand', 0, 'booked', 0))
$$;

grant execute on function public.agents_bookings_overview() to authenticated;
grant execute on function public.agent_bookings(uuid) to authenticated;

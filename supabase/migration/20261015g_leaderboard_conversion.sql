-- Leaderboard extras: settled conversion trend (8 weeks) and pricing source per person.
-- Pricing counts quote lines (currency neutral). 'legacy' = lines saved before tracking started.
-- Separate from quotes_leaderboard so the main board never breaks if this is missing.

begin;

create or replace function public.quotes_leaderboard_extra(p_period text default 'month', p_mode text default 'all')
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_since timestamptz;
  v_settled timestamptz;
  v_out jsonb;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  v_since := date_trunc(case when p_period in ('week', 'month', 'quarter', 'year') then p_period else 'month' end,
             now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';
  -- Last 8 weeks (Monday start, NZ). A week is "settled" once its last day is 14+ days old:
  -- customers have had time to answer, so its conversion is fair to compare.
  v_settled := date_trunc('week', now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';

  with base as (
    select q.id, q.created_by, q.status, q.created_at
    from quotes q
    where coalesce(p_mode, 'all') = 'all'
       or (p_mode = 'air' and (q.shipment_type ilike 'air' or q.shipment_mode ilike '%air%'))
       or (p_mode = 'fcl' and q.shipment_type ilike 'fcl')
       or (p_mode = 'lcl' and q.shipment_type ilike 'lcl')
  ), weeks as (
    select generate_series(v_settled - interval '7 weeks', v_settled, interval '1 week') as wk
  ), trend as (
    select b.created_by, w.wk,
           count(b.id)::int as quotes,
           count(b.id) filter (where b.status in ('won', 'crosswin'))::int as won
    from weeks w
    left join base b on b.created_at >= w.wk and b.created_at < w.wk + interval '1 week'
    group by 1, 2
  ), lines as (
    select b.created_by,
           case when l.rate_source in ('rate_card', 'local_charges', 'margin_rule', 'brainbox_rule') then 'card'
                when l.rate_source in ('cartage', 'template', 'lane_history') then 'other'
                when l.rate_source = 'manual' then 'manual'
                else 'legacy' end as grp,
           (l.rate_source in ('rate_card', 'local_charges') and l.suggested_sell is not null) as is_card_line,
           (l.rate_source in ('rate_card', 'local_charges') and l.suggested_sell is not null
             and l.sell_rate is distinct from l.suggested_sell) as edited
    from base b
    join quote_responses r on r.quote_id = b.id and coalesce(r.status, '') not in ('rejected', 'withdrawn')
    join quote_response_lines l on l.response_id = r.id
    where b.created_at >= v_since
  ), pricing as (
    select created_by,
           count(*) filter (where grp = 'card')::int as card,
           count(*) filter (where grp = 'other')::int as other,
           count(*) filter (where grp = 'manual')::int as manual,
           count(*) filter (where grp = 'legacy')::int as legacy,
           count(*) filter (where is_card_line)::int as card_lines,
           count(*) filter (where edited)::int as card_edited
    from lines group by 1
  )
  select jsonb_build_object(
    'week_start', v_settled,
    'staff', coalesce((
      select jsonb_object_agg(coalesce(k::text, 'none'), v) from (
        select u.created_by k, jsonb_build_object(
          'trend', (select jsonb_agg(jsonb_build_object('week', w.wk, 'quotes', coalesce(t.quotes, 0), 'won', coalesce(t.won, 0), 'settled', w.wk + interval '21 days' <= now()) order by w.wk)
                    from weeks w left join trend t on t.wk = w.wk and t.created_by is not distinct from u.created_by),
          'pricing', (select to_jsonb(p) - 'created_by' from pricing p where p.created_by is not distinct from u.created_by)
        ) v
        from (select distinct created_by from base where created_at >= v_since - interval '10 weeks') u
      ) s), '{}'::jsonb),
    'totals', jsonb_build_object(
      'trend', (select jsonb_agg(jsonb_build_object('week', x.wk, 'quotes', x.q, 'won', x.w, 'settled', x.wk + interval '21 days' <= now()) order by x.wk) from (
                  select w.wk, count(b.id)::int q, count(b.id) filter (where b.status in ('won', 'crosswin'))::int w
                  from weeks w left join base b on b.created_at >= w.wk and b.created_at < w.wk + interval '1 week'
                  group by 1) x),
      'pricing', (select jsonb_build_object(
                    'card', count(*) filter (where grp = 'card'),
                    'other', count(*) filter (where grp = 'other'),
                    'manual', count(*) filter (where grp = 'manual'),
                    'legacy', count(*) filter (where grp = 'legacy'),
                    'card_lines', count(*) filter (where is_card_line),
                    'card_edited', count(*) filter (where edited)) from lines))
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.quotes_leaderboard_extra(text, text) to authenticated;

commit;

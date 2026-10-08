-- Quotes leaderboard: staff + customer stats + Insights breakdowns for a period (week from Monday / month / quarter / year, NZ time).
-- Time to quote   = quote created -> first rate response created.
-- Email -> quote  = first inbound email (same customer account or contact email, within 3 days before
--                   quote creation, in the latest matching conversation) -> first rate response created.
drop function if exists public.quotes_leaderboard(text, text);
create function public.quotes_leaderboard(p_period text default 'month', p_mode text default 'all')
returns jsonb
language plpgsql stable
set search_path to 'public'
as $$
declare
  v_since timestamptz;
  v_days numeric;
  v_wdays numeric;
  v_out jsonb;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  v_since := date_trunc(case when p_period in ('week','month','quarter','year') then p_period else 'month' end,
             now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';
  v_days := greatest(extract(epoch from now() - v_since) / 86400.0, 1);
  select greatest(count(*), 1) into v_wdays
    from generate_series((v_since at time zone 'Pacific/Auckland')::date, (now() at time zone 'Pacific/Auckland')::date, interval '1 day') d
    where extract(isodow from d) < 6;

  with q as (
    select x.id, x.status, x.created_at, x.updated_at, x.created_by,
           case when x.shipment_type ilike 'air' or x.shipment_mode ilike '%air%' then 'Air'
                when x.shipment_type ilike 'fcl' then 'FCL' when x.shipment_type ilike 'lcl' then 'LCL'
                when x.shipment_type ilike '%courier%' or x.shipment_mode ilike '%courier%' then 'Courier'
                else 'Other' end as mode_label,
           initcap(coalesce(nullif(x.movement_type, ''), 'unknown')) as direction,
           initcap(coalesce(nullif(x.source, ''), 'manual')) as source_label,
           upper(coalesce(nullif(x.to_port_code, ''), '?')) as dest_code,
           upper(coalesce(nullif(x.from_port_code, ''), '?')) as origin_code,
           x.lost_reason,
           x.customer_account_id, coalesce(nullif(x.customer_name, ''), 'Unknown') as customer_name,
           (select min(r.created_at) from quote_responses r where r.quote_id = x.id) as first_resp,
           em.received_at
    from quotes x
    left join lateral (
      select min(m2.created_at) as received_at
      from (
        select m.conversation_id
        from inbox_messages m join inbox_conversations c on c.id = m.conversation_id
        where m.direction = 'in' and m.channel = 'email'
          and m.created_at between x.created_at - interval '3 days' and x.created_at
          and (c.account_id = x.customer_account_id or lower(c.contact_email) = lower(x.contact_email))
        order by m.created_at desc limit 1
      ) lc
      join inbox_messages m2 on m2.conversation_id = lc.conversation_id
      where m2.direction = 'in' and m2.created_at between x.created_at - interval '3 days' and x.created_at
    ) em on true
    where x.created_at >= v_since
      and (coalesce(p_mode,'all') = 'all'
        or (p_mode = 'air' and (x.shipment_type ilike 'air' or x.shipment_mode ilike '%air%'))
        or (p_mode = 'fcl' and x.shipment_type ilike 'fcl')
        or (p_mode = 'lcl' and x.shipment_type ilike 'lcl'))
  ), s as (
    select q.created_by as user_id,
      coalesce(nullif(su.full_name, ''), nullif(trim(coalesce(su.first_name,'') || ' ' || coalesce(su.last_name,'')), ''), su.email, 'Unassigned') as name,
      count(*)::int as quotes,
      count(*) filter (where q.status = 'open')::int as open,
      count(*) filter (where q.status in ('won','crosswin'))::int as won,
      count(*) filter (where q.status = 'lost')::int as lost,
      round(100.0 * count(*) filter (where q.status in ('won','crosswin'))
        / nullif(count(*) filter (where q.status in ('won','crosswin','lost')), 0), 0) as win_rate,
      round(avg(extract(epoch from q.first_resp - q.created_at) / 3600.0)::numeric, 1) as avg_hrs_to_quote,
      round(avg(extract(epoch from q.first_resp - q.received_at) / 3600.0)::numeric, 1) as avg_hrs_email_to_quote,
      count(*) filter (where q.received_at is not null and q.first_resp is not null)::int as email_matched
    from q left join staff_users su on su.user_id = q.created_by
    group by 1, 2
  ), c as (
    select q.customer_account_id as account_id, q.customer_name as name,
      count(*)::int as quotes,
      count(*) filter (where q.status = 'open')::int as open,
      count(*) filter (where q.status in ('won','crosswin'))::int as won,
      count(*) filter (where q.status = 'lost')::int as lost,
      round(100.0 * count(*) filter (where q.status in ('won','crosswin'))
        / nullif(count(*) filter (where q.status in ('won','crosswin','lost')), 0), 0) as win_rate,
      round(avg(extract(epoch from q.first_resp - q.created_at) / 3600.0)::numeric, 1) as avg_hrs_to_quote,
      max(q.created_at) as last_quote
    from q group by 1, 2
  )
  select jsonb_build_object(
    'since', v_since,
    'days', round(v_days, 2),
    'work_days', v_wdays,
    'totals', (select jsonb_build_object(
        'quotes', count(*), 'open', count(*) filter (where status = 'open'),
        'won', count(*) filter (where status in ('won','crosswin')), 'lost', count(*) filter (where status = 'lost'),
        'win_rate', round(100.0 * count(*) filter (where status in ('won','crosswin')) / nullif(count(*) filter (where status in ('won','crosswin','lost')), 0), 0),
        'avg_hrs_to_quote', round(avg(extract(epoch from first_resp - created_at) / 3600.0)::numeric, 1),
        'avg_hrs_email_to_quote', round(avg(extract(epoch from first_resp - received_at) / 3600.0)::numeric, 1),
        'customers', count(distinct coalesce(customer_account_id, customer_name))) from q),
    'staff', coalesce((select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'per_day', round(s.quotes / v_wdays, 1),
        'per_week', round(s.quotes / greatest(v_days / 7.0, 1), 1),
        'per_month', round(s.quotes / greatest(v_days / 30.44, 1), 1))
        order by s.quotes desc, s.won desc) from s), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(to_jsonb(c) order by c.quotes desc, c.won desc)
        from (select * from c order by quotes desc, won desc limit 100) c), '[]'::jsonb),
    -- Breakdowns for the Insights charts: [{label, n, won, lost}], biggest first.
    'mix', jsonb_build_object(
      'status', coalesce((select jsonb_agg(jsonb_build_object('label', l, 'n', n) order by n desc) from (
          select case status when 'won' then 'Won' when 'crosswin' then 'Cross win' when 'lost' then 'Lost' else 'Open' end l, count(*) n
          from q group by 1) t), '[]'::jsonb),
      'mode', coalesce((select jsonb_agg(jsonb_build_object('label', mode_label, 'n', n, 'won', w, 'lost', l) order by n desc) from (
          select mode_label, count(*) n, count(*) filter (where status in ('won','crosswin')) w, count(*) filter (where status = 'lost') l
          from q group by 1) t), '[]'::jsonb),
      'direction', coalesce((select jsonb_agg(jsonb_build_object('label', direction, 'n', n, 'won', w, 'lost', l) order by n desc) from (
          select direction, count(*) n, count(*) filter (where status in ('won','crosswin')) w, count(*) filter (where status = 'lost') l
          from q group by 1) t), '[]'::jsonb),
      'source', coalesce((select jsonb_agg(jsonb_build_object('label', source_label, 'n', n) order by n desc) from (
          select source_label, count(*) n from q group by 1) t), '[]'::jsonb),
      -- Countries (ISO2) so air and sea codes for the same place group together (NAN + FJLTK = FJ).
      'destination', coalesce((select jsonb_agg(jsonb_build_object('label', cc, 'n', n, 'won', w) order by n desc) from (
          select coalesce(pd.cc, '??') cc, count(*) n, count(*) filter (where q.status in ('won','crosswin')) w
          from q left join lateral (select upper(p.country_code) cc from ports p where p.code = q.dest_code limit 1) pd on true
          group by 1) t), '[]'::jsonb),
      'lane', coalesce((select jsonb_agg(jsonb_build_object('label', o || '>' || d, 'n', n, 'won', w) order by n desc) from (
          select coalesce(po.cc, '??') o, coalesce(pd.cc, '??') d, count(*) n, count(*) filter (where q.status in ('won','crosswin')) w
          from q
          left join lateral (select upper(p.country_code) cc from ports p where p.code = q.origin_code limit 1) po on true
          left join lateral (select upper(p.country_code) cc from ports p where p.code = q.dest_code limit 1) pd on true
          group by 1, 2 order by 3 desc limit 8) t), '[]'::jsonb),
      'lost_reason', coalesce((select jsonb_agg(jsonb_build_object('label', r, 'n', n) order by n desc) from (
          select coalesce(nullif(lost_reason, ''), 'No reason given') r, count(*) n from q where status = 'lost' group by 1) t), '[]'::jsonb)
    )
  ) into v_out;
  return v_out;
end $$;
grant execute on function public.quotes_leaderboard(text, text) to authenticated;
notify pgrst, 'reload schema';

-- Applied live via MCP 1 Oct 2026 (migration vessel_route_voyage_window).
-- Limit the booking vessel route to THIS voyage: last call at POL -> arrival at POD (+12h).
-- Before: every AIS point ever stored for the vessel, so repeat rotations drew overlapping loops.
create or replace function public.get_booking_vessel_route(p_booking_id uuid)
returns jsonb language sql stable as $function$
  with bk as (
    select b.id, b.vessel,
      coalesce(
        nullif(bt.vessel_key, ''),
        (select te.inbound_vessel_imo::text from public.tracking_events te
          where te.booking_id = b.id and te.inbound_vessel_imo is not null
          order by te.event_datetime desc limit 1)
      ) as vessel_key
    from public.bookings b
    left join public.booking_tracking bt on bt.booking_id = b.id
    where b.id = p_booking_id
  ),
  key as (
    select bk.id, bk.vessel,
      coalesce(
        bk.vessel_key,
        (select vpl.vessel_key from public.vessel_positions_latest vpl
          where coalesce(bk.vessel, '') <> ''
            and upper(regexp_replace(coalesce(vpl.ship_name, ''), '[^A-Za-z0-9]', '', 'g'))
              = upper(regexp_replace(bk.vessel, '[^A-Za-z0-9]', '', 'g'))
          limit 1)
      ) as vessel_key
    from bk
  ),
  ports_seen as (
    select te.partner_port_code as code, min(te.event_datetime) as first_seen, max(te.event_location) as loc
    from public.tracking_events te join bk on bk.id = te.booking_id
    where te.partner_port_code is not null
    group by te.partner_port_code
  ),
  -- Load port: PortConnect load port first, else earliest port seen in events.
  pol_code as (
    select coalesce(
      (select ct.raw->>'loadPortCode' from public.container_tracking ct
        where ct.booking_id = p_booking_id and coalesce(ct.raw->>'loadPortCode', '') <> '' limit 1),
      (select code from ports_seen order by first_seen limit 1)
    ) as code
  ),
  pol_geo as (
    select p.lat, p.lng from public.ports p, pol_code pc
    where p.kind = 'sea' and p.lat is not null and upper(p.code) = upper(pc.code)
    limit 1
  ),
  -- Voyage end: actual arrival at POD (+12h), else now.
  win_end as (
    select coalesce(
      (select min(ct.inbound_ata) from public.container_tracking ct where ct.booking_id = p_booking_id)
        + interval '12 hours',
      now()
    ) as t
  ),
  -- Voyage start: last AIS fix near POL before the end, else end - 40 days.
  win_start as (
    select coalesce(
      (select max(vp.position_timestamp) - interval '6 hours'
         from public.vessel_positions vp, pol_geo g, win_end e
        where vp.vessel_key = (select vessel_key from key)
          and abs(vp.latitude - g.lat) < 0.5 and abs(vp.longitude - g.lng) < 0.5
          and vp.position_timestamp < e.t - interval '2 days'),
      (select t - interval '40 days' from win_end)
    ) as t
  ),
  route as (
    select vp.longitude, vp.latitude, vp.position_timestamp,
      row_number() over (order by vp.position_timestamp) as rn,
      count(*) over () as total
    from public.vessel_positions vp
    where vp.vessel_key = (select vessel_key from key)
      and vp.position_timestamp >= (select t from win_start)
      and vp.position_timestamp <= (select t from win_end)
  ),
  route_ds as (
    select longitude, latitude, position_timestamp from route
    where total <= 350 or rn = 1 or rn = total or rn % (ceil(total / 350.0))::int = 0
    order by position_timestamp
  ),
  cur_pos as (
    select vp.latitude, vp.longitude, vp.position_timestamp,
      case when vp.true_heading between 1 and 359 then vp.true_heading::numeric
           else vp.course_over_ground::numeric end as heading,
      vp.speed_over_ground, vp.ship_name
    from public.vessel_positions vp
    where vp.vessel_key = (select vessel_key from key)
    order by vp.position_timestamp desc
    limit 1
  ),
  ports_geo as (
    select ps.code, ps.first_seen, coalesce(pg.name, initcap(ps.loc)) as name, pg.lat, pg.lng
    from ports_seen ps
    left join lateral (
      select p.name, p.lat, p.lng from public.ports p
      where p.kind = 'sea' and p.lat is not null and p.lng is not null
        and (upper(p.code) = upper(ps.code) or upper(p.name) = upper(coalesce(ps.loc, '')))
      order by (upper(p.code) = upper(ps.code)) desc
      limit 1
    ) pg on true
    where pg.lat is not null
  ),
  ports_ranked as (
    select code, name, lat, lng, first_seen,
      row_number() over (order by first_seen) as rn, count(*) over () as n
    from ports_geo
  )
  select jsonb_build_object(
    'vessel', coalesce((select ship_name from cur_pos), (select vessel from key)),
    'vessel_key', (select vessel_key from key),
    'current', (select to_jsonb(c) from cur_pos c),
    'window', jsonb_build_object('from', (select t from win_start), 'to', (select t from win_end)),
    'route', coalesce(
      (select jsonb_agg(jsonb_build_array(longitude, latitude) order by position_timestamp) from route_ds),
      '[]'::jsonb),
    'checkpoints', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'code', code, 'name', name, 'lat', lat, 'lng', lng,
          'role', case when rn = 1 then 'POL' when rn = n then 'POD' else 'CALL' end
        ) order by first_seen) from ports_ranked),
      '[]'::jsonb)
  );
$function$;

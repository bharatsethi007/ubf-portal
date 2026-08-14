-- Durable vessel linkage: SeaVantage refresh (Step 4) stamps the resolved mother-vessel
-- IMO here so the vessel map can join booking -> vessel_key -> vessel_positions_latest
-- instead of matching on vessel name.
alter table public.booking_tracking
  add column if not exists vessel_key  text,
  add column if not exists vessel_name text;

create index if not exists idx_booking_tracking_vessel_key
  on public.booking_tracking (vessel_key)
  where vessel_key is not null;

-- RPC: prefer vessel_key join, fall back to normalized vessel-name match.
create or replace function public.get_import_sea_vessel_positions()
returns table (
  booking_id uuid,
  booking_ref text,
  customer_name text,
  vessel text,
  latitude numeric,
  longitude numeric,
  heading numeric,
  speed_over_ground real,
  position_timestamp timestamptz
)
language sql
stable
as $$
  with active as (
    select
      b.id,
      b.booking_ref,
      b.vessel,
      bt.vessel_key,
      upper(regexp_replace(coalesce(b.vessel, ''), '[^A-Za-z0-9]', '', 'g')) as vkey_name,
      cust.name as customer_name
    from public.bookings b
    left join public.customers cust on cust.account_id = b.account_id
    left join public.booking_tracking bt on bt.booking_id = b.id
    where b.mode = 'sea_import'
      and b.archived_at is null
  )
  select
    a.id as booking_id,
    a.booking_ref,
    a.customer_name,
    coalesce(pos.ship_name, a.vessel) as vessel,
    pos.latitude,
    pos.longitude,
    case
      when pos.true_heading is not null and pos.true_heading between 1 and 359
        then pos.true_heading::numeric
      else pos.course_over_ground::numeric
    end as heading,
    pos.speed_over_ground,
    pos.position_timestamp
  from active a
  left join lateral (
    select vpl.*
    from public.vessel_positions_latest vpl
    where (a.vessel_key is not null and vpl.vessel_key = a.vessel_key)
       or (a.vessel_key is null
           and a.vkey_name <> ''
           and upper(regexp_replace(coalesce(vpl.ship_name, ''), '[^A-Za-z0-9]', '', 'g')) = a.vkey_name)
    order by vpl.position_timestamp desc nulls last
    limit 1
  ) pos on true
  where pos.latitude is not null
    and pos.longitude is not null;
$$;

grant execute on function public.get_import_sea_vessel_positions() to authenticated;

notify pgrst, 'reload schema';

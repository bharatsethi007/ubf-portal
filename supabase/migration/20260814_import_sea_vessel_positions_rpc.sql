-- Live vessel positions for active Import Sea jobs (staff-only via RLS on underlying tables).
-- One row per active sea_import booking that resolves to a current AIS/SeaVantage position.
-- v1 join: normalized vessel name (bookings.vessel <-> vessel_positions_latest.ship_name).
-- Durable upgrade lands in 20260814_booking_tracking_vessel_key.sql (join on vessel_key).
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
      upper(regexp_replace(coalesce(b.vessel, ''), '[^A-Za-z0-9]', '', 'g')) as vkey,
      cust.name as customer_name
    from public.bookings b
    left join public.customers cust on cust.account_id = b.account_id
    where b.mode = 'sea_import'
      and b.archived_at is null
  )
  select distinct on (a.id)
    a.id as booking_id,
    a.booking_ref,
    a.customer_name,
    coalesce(vpl.ship_name, a.vessel) as vessel,
    vpl.latitude,
    vpl.longitude,
    case
      when vpl.true_heading is not null and vpl.true_heading between 1 and 359
        then vpl.true_heading::numeric
      else vpl.course_over_ground::numeric
    end as heading,
    vpl.speed_over_ground,
    vpl.position_timestamp
  from active a
  join public.vessel_positions_latest vpl
    on a.vkey <> ''
   and upper(regexp_replace(coalesce(vpl.ship_name, ''), '[^A-Za-z0-9]', '', 'g')) = a.vkey
  where vpl.latitude is not null
    and vpl.longitude is not null
  order by a.id, vpl.position_timestamp desc nulls last;
$$;

grant execute on function public.get_import_sea_vessel_positions() to authenticated;

notify pgrst, 'reload schema';

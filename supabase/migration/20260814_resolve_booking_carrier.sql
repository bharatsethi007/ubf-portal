-- Single source of truth for "which carrier is this booking on?".
-- Priority: explicitly picked shipping_line_code, else auto-detect from a container prefix
-- that matches sv_carrier_map.known_prefixes.
create or replace function public.resolve_booking_carrier(p_booking_id uuid)
returns table (
  line_code       text,
  sv_carrier_code text,
  is_maersk       boolean,
  verified        boolean,
  resolved_from   text
)
language sql
stable
as $$
  with picked as (
    select m.line_code, m.sv_carrier_code, m.is_maersk, m.verified, 'picked'::text as resolved_from
    from public.bookings b
    join public.sv_carrier_map m on m.line_code = b.shipping_line_code
    where b.id = p_booking_id
      and b.shipping_line_code is not null and b.shipping_line_code <> ''
  ),
  by_prefix as (
    select m.line_code, m.sv_carrier_code, m.is_maersk, m.verified, 'prefix'::text as resolved_from
    from public.booking_containers bc
    join public.sv_carrier_map m
      on upper(left(bc.container_no, 4)) = any (m.known_prefixes)
    where bc.booking_id = p_booking_id
      and bc.container_no is not null and bc.container_no <> ''
      and not exists (select 1 from picked)
    order by bc.sort_order
    limit 1
  )
  select * from picked
  union all
  select * from by_prefix
  limit 1;
$$;

grant execute on function public.resolve_booking_carrier(uuid) to authenticated, service_role;
notify pgrst, 'reload schema';

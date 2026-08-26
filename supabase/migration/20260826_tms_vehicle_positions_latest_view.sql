-- ============================================================
-- TMS Step 4c — latest-position-per-vehicle view for the dispatch truck map.
-- Applied live to cpnkudbdzgnzmodhsrbf on 26 Aug 2026 via MCP.
-- Repo-parity copy for supabase/migration (singular).
-- security_invoker = true so the underlying tms_vehicle_positions /
-- tms_vehicles RLS (staff_all) applies to the caller.
-- ============================================================

create or replace view public.tms_vehicle_positions_latest
with (security_invoker = true) as
select distinct on (p.vehicle_id)
  p.vehicle_id, v.registration_number, v.description,
  p.lat, p.lng, p.heading, p.speed_kmh, p.source, p.recorded_at
from public.tms_vehicle_positions p
join public.tms_vehicles v on v.id = p.vehicle_id
order by p.vehicle_id, p.recorded_at desc;

grant select on public.tms_vehicle_positions_latest to authenticated;
notify pgrst, 'reload schema';

-- ============================================================
-- TMS Check-in actuals + variance view (4a).
-- Applied live to cpnkudbdzgnzmodhsrbf on 26 Aug 2026 via MCP.
-- Repo-parity copy for supabase/migration.
-- ============================================================

-- Keep entered dims; record actuals alongside (billing-dispute proof)
alter table public.tms_consignment_cargo
  add column if not exists actual_units numeric,
  add column if not exists actual_length_cm numeric,
  add column if not exists actual_width_cm numeric,
  add column if not exists actual_height_cm numeric,
  add column if not exists actual_weight_kg numeric,
  add column if not exists actual_total_cube_m3 numeric;

-- Warehouse check-in stamp (pickup verified into warehouse)
alter table public.tms_consignments
  add column if not exists wms_checkin_at timestamptz,
  add column if not exists wms_checkin_by uuid;

-- Old vs new CBM per checked-in pickup (variance tab)
create or replace view public.tms_checkin_variance with (security_invoker = true) as
select c.id as consignment_id, c.consignment_no, c.wms_checkin_at,
       coalesce(sum(cg.total_cube_m3), 0) as old_cbm,
       coalesce(sum(coalesce(cg.actual_total_cube_m3, cg.total_cube_m3)), 0) as new_cbm
from public.tms_consignments c
join public.tms_consignment_cargo cg on cg.consignment_id = c.id
where c.order_type = 'pick-up' and c.wms_checkin_at is not null
group by c.id, c.consignment_no, c.wms_checkin_at;

grant select on public.tms_checkin_variance to authenticated;
notify pgrst, 'reload schema';

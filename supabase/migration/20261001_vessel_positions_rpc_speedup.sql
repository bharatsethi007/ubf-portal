-- Applied live via MCP 1 Oct 2026 (migrations vessel_positions_rpc_speedup + rls_is_staff_initplan_tracking).
-- Fix: Import Sea board "Failed to load vessels" = statement timeout. The RPC re-ran the
-- vessel_positions_latest view (DISTINCT ON over every AIS point) per booking, and RLS
-- called is_staff() per row. Now: latest positions computed once; is_staff() as an initPlan.
-- Function body: see pg_get_functiondef('public.get_import_sea_vessel_positions'::regproc).

alter policy staff_all_vessel_positions on public.vessel_positions using ((select is_staff()));
alter policy staff_all_tracking_events on public.tracking_events using ((select is_staff()));
alter policy staff_all_booking_tracking on public.booking_tracking using ((select is_staff()));
alter policy staff_all_bookings on public.bookings using ((select is_staff()));

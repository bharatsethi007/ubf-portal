-- 20260929_portal_bookings_request.sql  (applied live via MCP 29 Sep; parity copy, do not re-run blindly)
-- 1) one live booking per ERP shipment
-- 2) matcher: booking ref found in ERP customer_ref / marks / goods_desc is decisive (+100); window widened to 120 days;
--    auto-link skips shipments already taken by another live booking
-- 3) portal_bookings view: customer-safe booking feed with portal_status (requested / confirmed / in_erp / declined)
-- 4) bookings.customer_ref + bookings.requested_by; module-aware booking refs (UBF-SI / SE / AI / AE)
-- 5) portal_request_booking(jsonb) RPC: customer booking request -> bookings (source customer_portal, status submitted)
-- 6) log_booking_history: customer actors logged as "portal: <email>" with null actor_id (actor_id references staff_users)
-- Full SQL for each object is in the Supabase migration history:
--   portal_bookings_unified_and_ref_match, portal_request_booking, booking_history_customer_actor
create unique index if not exists bookings_one_live_per_shipment
  on public.bookings (shipment_id) where archived_at is null and shipment_id is not null;
alter table public.bookings add column if not exists customer_ref text;
alter table public.bookings add column if not exists requested_by uuid references auth.users(id) on delete set null;
notify pgrst, 'reload schema';

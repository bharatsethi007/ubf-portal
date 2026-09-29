-- Pre-launch lockdown: close data exposed to the public anon key and to customer portal logins.
-- Found by running every public table/view as anon and as a customer (Floorco) login:
--   v_customer_stats (all 9k customers), v_agent_reciprocity (agent revenue + GP), v_agent_reconciliation,
--   dispatch_vehicle_positions_latest (truck GPS), vessel_positions_latest, mv_consol_teu were readable by anyone.
-- Views that staff read directly now run as the caller (security_invoker), so the staff-only RLS underneath applies.
-- Views/matviews only used inside SECURITY DEFINER RPCs or Edge Functions lose their direct grants.
-- Ungated functions that could be abused (heavy refreshes, WhatsApp CSAT enqueue) are service-role only.
-- Customer-facing portal_* views stay SECURITY DEFINER on purpose: each filters by my_account_id().
-- Idempotent.

-- Staff read these directly from the console; RLS on customers/shipments/contacts/portal_users is staff-only.
alter view public.v_customer_stats set (security_invoker = true);
alter view public.dispatch_vehicle_positions_latest set (security_invoker = true);
alter view public.vessel_positions_latest set (security_invoker = true);

-- Only reached through report_agent_reciprocity() (staff-gated, SECURITY DEFINER). GP must never be REST-readable.
revoke all on public.v_agent_reciprocity from anon, authenticated;
revoke all on public.v_agent_reconciliation from anon, authenticated;

-- Consol TEU counts feed staff sea reports (invoker functions), so logged-in access stays; anon loses it.
revoke all on public.mv_consol_teu from anon;
revoke all on public.air_flight_routes from anon;
-- Flight suggestions are a staff booking helper: no anonymous access.
revoke execute on function public.get_flight_suggestions(text, text) from public, anon;
grant execute on function public.get_flight_suggestions(text, text) to authenticated;

-- Heavy or abusable with no internal check: service role (cron, sync scripts, Edge Functions) only.
revoke execute on function public.refresh_job_financials() from public, anon, authenticated;
revoke execute on function public.refresh_consol_teu() from public, anon, authenticated;
revoke execute on function public.csat_whatsapp_enqueue(uuid, text) from public, anon, authenticated;
revoke execute on function public.resolve_cartage_zone(text, text, text) from public, anon;
grant execute on function public.resolve_cartage_zone(text, text, text) to authenticated;

notify pgrst, 'reload schema';

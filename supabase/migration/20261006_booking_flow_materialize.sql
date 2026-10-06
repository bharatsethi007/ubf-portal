-- v_booking_flow perf fix. Applied via MCP 6 Oct 2026. Idempotent.
-- CTE "a" (next_action) is now MATERIALIZED so it is computed once per booking.
-- Before: urgency/priority re-ran the container/task subqueries hundreds of times per row
-- (3.9s for 90 bookings; Bookings tab counts polled every 60s and caused 8s timeouts portal-wide).
-- After: identical output (md5 verified), 24ms for the counts query.
do $$ declare d text;
begin
  d := pg_get_viewdef('public.v_booking_flow'::regclass);
  if position('), a AS MATERIALIZED (' in d) > 0 then return; end if;
  if position('), a AS (' in d) = 0 then raise exception 'anchor missing'; end if;
  execute 'create or replace view public.v_booking_flow with (security_invoker = true) as ' || replace(d, '), a AS (', '), a AS MATERIALIZED (');
end $$;
notify pgrst, 'reload schema';

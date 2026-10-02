-- IS board auto-stop pills: align automation ETA with the board's ETA + staff restart RPC.
-- Board reads stop state straight from booking_tracking (board RPCs unchanged).
-- Applied via MCP 2 Oct 2026. Repo parity copy, do not re-run.

-- ETA used by the automation = same sources as the board (vessel ATA, else vessel ETA, ERP shipment ETA, manual), then line events.
create or replace function public.import_sea_booking_eta(p_booking uuid)
returns date language sql stable security definer set search_path = public
as $fn$
  select coalesce(
    (select min(coalesce(ct.inbound_ata, ct.inbound_eta))::date from container_tracking ct where ct.booking_id = p_booking),
    (select s.eta::date from bookings b join shipments s on s.job_unique = b.shipment_id where b.id = p_booking),
    (select coalesce(b.eta, b.m_eta) from bookings b where b.id = p_booking),
    (select max(e.event_datetime)::date from tracking_events e where e.booking_id = p_booking
       and ((e.source = 'seavantage' and e.event_type_code = 'VA' and e.event_value2 = 'POD')
         or (e.source = 'carrier' and e.event_type_code = 'ARRI'))))
$fn$;

-- Staff restart: clear an auto-stop so the automation picks the booking up again.
create or replace function public.import_sea_tracking_restart(p_booking uuid, p_kind text)
returns void language plpgsql security definer set search_path = public
as $fn$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if p_kind = 'portconnect' then
    update booking_tracking set pc_auto_stopped_at = null, pc_auto_stop_reason = null, last_portconnect_sync = null where booking_id = p_booking;
  elsif p_kind = 'carrier' then
    update booking_tracking set carrier_auto_stopped_at = null, carrier_auto_stop_reason = null where booking_id = p_booking;
  else raise exception 'p_kind must be portconnect or carrier'; end if;
  insert into booking_history (booking_id, field, old_value, new_value, action, actor_id, actor_name)
  values (p_booking, case when p_kind = 'portconnect' then 'portconnect_auto' else 'carrier_sync_auto' end, 'off', 'on: restarted', 'auto_restarted', auth.uid(),
          (select split_part(email, '@', 1) from staff_users where user_id = auth.uid()));
end
$fn$;
revoke all on function public.import_sea_tracking_restart(uuid, text) from public, anon;
grant execute on function public.import_sea_tracking_restart(uuid, text) to authenticated;

notify pgrst, 'reload schema';

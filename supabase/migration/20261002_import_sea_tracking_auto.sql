-- Import Sea FCL tracking automation.
--  PortConnect: refresh daily while enabled. Auto-stop when every container is gated out / delivered,
--               or ETA + 10 days passed (stop + alert task to the handler).
--  Shipping line (Maersk API / SeaVantage): refresh every 2 hours. Auto-stop when every empty is
--               returned, or ETA + 17 days passed.
-- Empty return = SeaVantage RD (actual) or Maersk empty gate-in at POD, per container. bookings.container_return_date is NOT used (holds planned dates).
-- Stops are recorded on booking_tracking and booking_history; staff can restart by clearing *_auto_stopped_at.
-- Applied via MCP 2 Oct 2026. Repo parity copy, do not re-run.

alter table public.booking_tracking
  add column if not exists pc_auto_stopped_at timestamptz,
  add column if not exists pc_auto_stop_reason text,
  add column if not exists carrier_auto_stopped_at timestamptz,
  add column if not exists carrier_auto_stop_reason text;

-- Best ETA for an import booking: booking row, then PortConnect vessel ATA/ETA, then SeaVantage / Maersk arrival at POD.
create or replace function public.import_sea_booking_eta(p_booking uuid)
returns date language sql stable security definer set search_path = public
as $fn$
  select coalesce(
    (select coalesce(b.eta, b.m_eta) from bookings b where b.id = p_booking),
    (select min(coalesce(ct.inbound_ata, ct.inbound_eta))::date from container_tracking ct where ct.booking_id = p_booking),
    (select max(e.event_datetime)::date from tracking_events e where e.booking_id = p_booking
       and ((e.source = 'seavantage' and e.event_type_code = 'VA' and e.event_value2 = 'POD')
         or (e.source = 'carrier' and e.event_type_code = 'ARRI'))))
$fn$;
revoke all on function public.import_sea_booking_eta(uuid) from public, anon;
grant execute on function public.import_sea_booking_eta(uuid) to authenticated, service_role;

-- Marks stops (with history + alert) and returns the bookings still due a refresh.
create or replace function public.import_sea_tracking_sweep(p_kind text, p_limit int default 200)
returns table (booking_id uuid, engine text)
language plpgsql security definer set search_path = public
as $fn$
declare r record;
begin
  if p_kind not in ('portconnect', 'carrier') then raise exception 'p_kind must be portconnect or carrier'; end if;

  for r in
    select b.id, b.handled_by, eta.eta,
      not exists (
        select 1 from booking_containers c where c.booking_id = b.id
          and not exists (select 1 from container_tracking ct where ct.booking_id = b.id
                            and upper(ct.container_no) = upper(c.container_no)
                            and coalesce(ct.gate_out_at, ct.delivered_at) is not null)) as all_gated,
      not exists (
        select 1 from booking_containers c where c.booking_id = b.id
          and not exists (select 1 from tracking_events e where e.booking_id = b.id
                            and upper(e.container_no) = upper(c.container_no)
                            and ((e.source = 'seavantage' and e.event_type_code = 'RD' and coalesce(e.is_estimated, false) = false)
                              or (e.source = 'carrier' and e.event_type_code = 'GTIN' and e.raw->>'emptyIndicatorCode' = 'EMPTY'
                                  and e.event_datetime::date >= coalesce(eta.eta - 2, '1900-01-01'::date))))) as all_returned
    from bookings b
    join booking_tracking t on t.booking_id = b.id
    cross join lateral (select public.import_sea_booking_eta(b.id) as eta) eta
    where b.module = 'IS' and b.archived_at is null and coalesce(b.load_type, 'FCL') = 'FCL'
      and exists (select 1 from booking_containers c where c.booking_id = b.id)
      and case when p_kind = 'portconnect'
               then t.portconnect_enabled is true and t.pc_auto_stopped_at is null
               else (t.carrier_enabled is true or t.seavantage_enabled is not false) and t.carrier_auto_stopped_at is null end
  loop
    if p_kind = 'portconnect' then
      if r.all_gated then
        update booking_tracking set pc_auto_stopped_at = now(), pc_auto_stop_reason = 'gated_out' where booking_tracking.booking_id = r.id;
        insert into booking_history (booking_id, field, old_value, new_value, action, actor_name)
        values (r.id, 'portconnect_auto', 'on', 'off: all containers gated out', 'auto_stopped', 'Automation');
      elsif r.eta is not null and r.eta < current_date - 10 then
        update booking_tracking set pc_auto_stopped_at = now(), pc_auto_stop_reason = 'eta_plus_10' where booking_tracking.booking_id = r.id;
        insert into booking_history (booking_id, field, old_value, new_value, action, actor_name)
        values (r.id, 'portconnect_auto', 'on', 'off: ETA + 10 days, not gated out', 'auto_stopped', 'Automation');
        insert into booking_tasks (booking_id, title, is_default, sort_order, status, assigned_to, due_date, billable)
        values (r.id, 'Alert: PortConnect auto-refresh stopped. ETA ' || to_char(r.eta, 'DD Mon') || ' + 10 days and container not gated out. Check status.',
                false, 900, 'open', r.handled_by, current_date, false);
      end if;
    else
      if r.all_returned then
        update booking_tracking set carrier_auto_stopped_at = now(), carrier_auto_stop_reason = 'empty_returned' where booking_tracking.booking_id = r.id;
        insert into booking_history (booking_id, field, old_value, new_value, action, actor_name)
        values (r.id, 'carrier_sync_auto', 'on', 'off: empty returned', 'auto_stopped', 'Automation');
      elsif r.eta is not null and r.eta < current_date - 17 then
        update booking_tracking set carrier_auto_stopped_at = now(), carrier_auto_stop_reason = 'eta_plus_17' where booking_tracking.booking_id = r.id;
        insert into booking_history (booking_id, field, old_value, new_value, action, actor_name)
        values (r.id, 'carrier_sync_auto', 'on', 'off: ETA + 17 days', 'auto_stopped', 'Automation');
      end if;
    end if;
  end loop;

  -- Still running and due: PortConnect once a day, shipping line every 2 hours. Oldest sync first.
  if p_kind = 'portconnect' then
    return query
      select t.booking_id, 'portconnect'::text
      from booking_tracking t join bookings b on b.id = t.booking_id
      where b.module = 'IS' and b.archived_at is null and coalesce(b.load_type, 'FCL') = 'FCL'
        and t.portconnect_enabled is true and t.pc_auto_stopped_at is null
        and exists (select 1 from booking_containers c where c.booking_id = b.id)
        and (t.last_portconnect_sync is null or t.last_portconnect_sync < now() - interval '20 hours')
      order by t.last_portconnect_sync nulls first
      limit p_limit;
  else
    return query
      select t.booking_id, case when coalesce((select rc.is_maersk from resolve_booking_carrier(t.booking_id) rc limit 1), false)
                                 and t.carrier_enabled is true then 'carrier' else 'seavantage' end
      from booking_tracking t join bookings b on b.id = t.booking_id
      where b.module = 'IS' and b.archived_at is null and coalesce(b.load_type, 'FCL') = 'FCL'
        and (t.carrier_enabled is true or t.seavantage_enabled is not false) and t.carrier_auto_stopped_at is null
        and exists (select 1 from booking_containers c where c.booking_id = b.id)
        and greatest(coalesce(t.last_carrier_sync, '-infinity'), coalesce(t.last_seavantage_sync, '-infinity')) < now() - interval '100 minutes'
      order by greatest(coalesce(t.last_carrier_sync, '-infinity'), coalesce(t.last_seavantage_sync, '-infinity'))
      limit p_limit;
  end if;
end
$fn$;

revoke all on function public.import_sea_tracking_sweep(text, int) from public, anon, authenticated;
grant execute on function public.import_sea_tracking_sweep(text, int) to service_role;

notify pgrst, 'reload schema';

-- Cron (applied via MCP 2 Oct 2026). PortConnect 4:30am + 4:50am NZST (5:30/5:50 NZDT); shipping line every 2h at :23.
-- select cron.schedule('is-portconnect-daily', '30,50 16 * * *', $c$ select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/import-sea-tracking-auto', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')), body := '{"mode":"portconnect"}'::jsonb, timeout_milliseconds := 150000); $c$);
-- select cron.schedule('is-carrier-sync-2h', '23 */2 * * *', $c$ ... body := '{"mode":"carrier"}'::jsonb ... $c$);

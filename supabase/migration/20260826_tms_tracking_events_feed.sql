-- ============================================================
-- TMS Step 5a — TMS -> tracking_events feed (integration spine, half 1).
-- Applied live to cpnkudbdzgnzmodhsrbf on 26 Aug 2026 via MCP.
-- Repo-parity copy for supabase/migration (singular).
--
-- A booking-linked consignment's status change, and any POD capture, emit a
-- customer-facing milestone into public.tracking_events (source='tms'), which
-- the booking record timeline already reads (no source filter). SECURITY DEFINER
-- so the triggers write regardless of the acting user's grants on tracking_events.
-- ============================================================

-- Dedup index for TMS-sourced rows (mirrors the carrier/seavantage partials)
create unique index if not exists tracking_events_tms_unique
  on public.tracking_events (booking_id, carrier_event_id)
  where source = 'tms' and carrier_event_id is not null;

-- Status change -> milestone
create or replace function public.tms_emit_tracking_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if new.booking_id is null or new.status is not distinct from old.status then
    return new;
  end if;
  code := case
    when new.status in ('assigned','assignedLeg2')  then 'TMS_ALLOCATED'
    when new.status in ('inTransit','inTransitLeg2') then 'TMS_ONBOARD'
    when new.status in ('complete','checked_in')     then 'TMS_DELIVERED'
    when new.status in ('failed','inComplete')       then 'TMS_FAILED'
    else null end;
  if code is null then return new; end if;
  insert into public.tracking_events
    (booking_id, event_type_code, event_datetime, event_location, event_value, source,
     carrier_event_id, is_estimated, received_at, raw)
  values
    (new.booking_id, code, now(), coalesce(new.receiver_company, new.sender_company),
     new.consignment_no, 'tms', 'tms:'||new.id||':'||code, false, now(),
     jsonb_build_object('consignment_id', new.id, 'consignment_no', new.consignment_no, 'status', new.status))
  on conflict (booking_id, carrier_event_id) where source = 'tms' and carrier_event_id is not null do nothing;
  return new;
end; $$;

drop trigger if exists tms_consignments_emit_event on public.tms_consignments;
create trigger tms_consignments_emit_event
  after update on public.tms_consignments
  for each row execute function public.tms_emit_tracking_event();

-- POD capture -> proof-of-delivery milestone
create or replace function public.tms_pod_emit_tracking_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare bkg uuid; cno text; loc text;
begin
  select booking_id, consignment_no, coalesce(receiver_company, sender_company)
    into bkg, cno, loc
  from public.tms_consignments where id = new.consignment_id;
  if bkg is null then return new; end if;
  insert into public.tracking_events
    (booking_id, event_type_code, event_datetime, event_location, event_value, source,
     carrier_event_id, is_estimated, received_at, raw)
  values
    (bkg, 'TMS_POD', coalesce(new.captured_at, now()), loc, cno, 'tms',
     'tms:'||new.consignment_id||':POD:'||new.id, false, now(),
     jsonb_build_object('pod_id', new.id, 'consignment_id', new.consignment_id, 'rating', new.rating))
  on conflict (booking_id, carrier_event_id) where source = 'tms' and carrier_event_id is not null do nothing;
  return new;
end; $$;

drop trigger if exists tms_pod_emit_event on public.tms_pod;
create trigger tms_pod_emit_event
  after insert on public.tms_pod
  for each row execute function public.tms_pod_emit_tracking_event();

notify pgrst, 'reload schema';

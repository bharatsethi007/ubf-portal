-- Status bar for an inbox conversation: where its job is and the next suggested action.
-- Exports (EA/ES): Booked -> Pickup / Drop-off -> Checked in -> SLI -> Consol -> Departed.
-- Imports (IS/IA): the booking flow stages (Request -> Booked -> Transit -> At port -> Invoice -> Closed) + flow next action.
create or replace function public.inbox_job_status(p_conv uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare c record; b public.bookings%rowtype; t record; s record; sh record; f record;
  steps jsonb := '[]'; nxt jsonb; v_consol text; v_door boolean;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select id, booking_id, email_mailbox, eff_status into c
    from (select id, booking_id, email_mailbox, public.inbox_eff_status(status, snoozed_until) eff_status from public.inbox_conversations where id = p_conv) x;
  if c.id is null then return null; end if;
  if c.booking_id is null then
    return jsonb_build_object('booking', null,
      'next', case when c.email_mailbox = 'exportair.nz@ubfreight.com' then jsonb_build_object('label', 'Create export air booking', 'action', 'ea-booking')
                   else jsonb_build_object('label', 'Create or link a booking', 'action', 'create-booking') end);
  end if;
  select * into b from public.bookings where id = c.booking_id;
  if b.id is null then return null; end if;

  if b.module in ('EA', 'ES') then
    select count(*) n, max(consignment_no) no, max(status) st, bool_or(wms_checkin_at is not null) checked, max(wms_checkin_at) checked_at,
           bool_or(picked_up_at is not null) picked
      into t from public.tms_consignments where booking_id = b.id and status not in ('cancel', 'archived');
    select status, sent_at, endorsed_at into s from public.sli_documents where booking_id = b.id order by created_at desc limit 1;
    select master_bill, consol_key, vessel_flight, etd, departed into sh from public.shipments where job_unique = b.shipment_id limit 1;
    v_consol := coalesce(nullif(b.mawb, ''), sh.master_bill, sh.consol_key);
    v_door := b.service_type like 'door%' or t.n > 0;

    steps := jsonb_build_array(
      jsonb_build_object('key', 'booked', 'label', 'Booked', 'state', case when b.status in ('draft', 'submitted', 'parsed', 'new') then 'current' else 'done' end,
        'detail', b.booking_ref),
      case when v_door then jsonb_build_object('key', 'pickup', 'label', 'Pickup',
          'state', case when t.picked or t.checked then 'done' when t.n > 0 then 'current' else 'todo' end,
          'detail', coalesce(t.no || ' · ' || t.st, 'Not booked'))
        else jsonb_build_object('key', 'pickup', 'label', 'Drop-off', 'state', case when t.checked then 'done' else 'current' end, 'detail', 'Supplier delivers') end,
      jsonb_build_object('key', 'checkin', 'label', 'Checked in', 'state', case when t.checked then 'done' else 'todo' end,
        'detail', case when t.checked then concat_ws(' ', b.pieces || ' pcs', round(b.gross_weight_kg) || ' kg') end),
      jsonb_build_object('key', 'sli', 'label', 'SLI', 'state', case when s.status = 'endorsed' then 'done' when s.status in ('sent', 'viewed', 'changes_requested') then 'current' else 'todo' end,
        'detail', case s.status when 'endorsed' then 'Received' when 'sent' then 'Sent' when 'viewed' then 'Viewed' when 'changes_requested' then 'Changes asked' when 'expired' then 'Expired' when 'draft' then 'Draft' else 'Not sent' end),
      jsonb_build_object('key', 'consol', 'label', 'Consol', 'state', case when v_consol is not null then 'done' else 'todo' end,
        'detail', coalesce(v_consol || coalesce(' · ' || coalesce(nullif(b.flight_no, ''), sh.vessel_flight), ''), 'Not assigned')),
      jsonb_build_object('key', 'departed', 'label', 'Departed', 'state', case when sh.departed is not null then 'done' else 'todo' end,
        'detail', to_char(coalesce(sh.departed, sh.etd, b.etd), 'DD Mon')));

    nxt := case
      when b.status in ('draft', 'submitted', 'parsed', 'new') then jsonb_build_object('label', 'Review and confirm booking', 'action', 'open')
      when v_door and coalesce(t.n, 0) = 0 then jsonb_build_object('label', 'Book pickup', 'action', 'pickup')
      when not coalesce(t.checked, false) then jsonb_build_object('label', case when t.n > 0 then 'Waiting for pickup and check-in' else 'Waiting for supplier drop-off' end, 'action', null)
      when s.status is null or s.status in ('draft', 'expired') then jsonb_build_object('label', 'Send SLI to shipper', 'action', 'sli')
      when s.status in ('sent', 'viewed', 'changes_requested') then jsonb_build_object('label', 'Chase SLI', 'action', 'sli')
      when v_consol is null then jsonb_build_object('label', 'Assign to consol', 'action', 'open')
      when sh.departed is null then jsonb_build_object('label', 'Waiting to fly', 'action', null)
      else jsonb_build_object('label', 'Departed. Send pre-alert', 'action', null) end;
  else
    select stage, next_action, action_due, urgency into f from public.v_booking_flow where booking_id = b.id;
    select jsonb_agg(jsonb_build_object('key', k, 'label', l,
             'state', case when o < array_position(array['request','booked','in_transit','arrived','invoicing','closed'], f.stage) then 'done'
                           when k = f.stage then 'current' else 'todo' end) order by o)
      into steps
      from unnest(array['request','booked','in_transit','arrived','invoicing','closed'], array['Request','Booked','Transit','At port','Invoice','Closed'])
           with ordinality as x(k, l, o);
    nxt := case when f.next_action is not null then jsonb_build_object('label', f.next_action, 'action', 'open', 'due', f.action_due, 'urgency', f.urgency) end;
  end if;

  return jsonb_build_object('booking', jsonb_build_object('id', b.id, 'ref', b.booking_ref, 'module', b.module, 'status', b.status),
                            'steps', steps, 'next', nxt);
end $$;

grant execute on function public.inbox_job_status(uuid) to authenticated;

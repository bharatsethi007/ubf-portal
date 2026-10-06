-- Export flow plumbing:
-- 1) booking_create_pickup: one pickup job (tms_consignments) from a booking, cargo lines copied, delivered to the UBF depot.
-- 2) Warehouse check-in writes the actual pieces / weight / dims back onto the booking (cargo lines + totals + chargeable).
-- 3) Confirming a customer-portal export booking that has a pickup address creates its pickup automatically.

create or replace function public.booking_create_pickup(p_booking uuid, p_ready timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare b public.bookings%rowtype; d public.tms_depots%rowtype; v_id uuid; v_no text; v_po text; v_supplier text; n int := 0;
begin
  if auth.uid() is not null and not public.is_staff() then raise exception 'Staff only'; end if;
  select * into b from public.bookings where id = p_booking;
  if b.id is null then raise exception 'Booking not found'; end if;
  select id, consignment_no into v_id, v_no from public.tms_consignments
   where booking_id = p_booking and order_type = 'pick-up' and status not in ('cancel', 'archived') limit 1;
  if v_id is not null then return jsonb_build_object('id', v_id, 'consignment_no', v_no, 'existing', true); end if;

  select * into d from public.tms_depots where active order by created_at limit 1;
  select po_number, supplier_name into v_po, v_supplier from public.booking_suppliers where booking_id = p_booking order by ord limit 1;

  insert into public.tms_consignments (order_type, status, source, booking_id, mode, depot_id, reference, po_number, supplier_name,
      sender_company, sender_address, sender_contact, sender_phone, sender_email,
      receiver_company, receiver_address, receiver_lat, receiver_lng,
      preferred_pickup_at, goods_type, dangerous_goods_reason, sender_additional_info, created_by)
  values ('pick-up', 'unassigned', 'booking', b.id, b.module, d.id, b.booking_ref, coalesce(v_po, b.customer_ref), coalesce(v_supplier, b.shipper_name),
      coalesce(b.shipper_name, v_supplier),
      coalesce(nullif(btrim(b.pickup_address), ''), nullif(concat_ws(', ', nullif(b.shipper_address, ''), nullif(b.shipper_city, ''), nullif(b.shipper_postcode, '')), '')),
      b.shipper_contact, b.shipper_phone, b.shipper_email,
      coalesce(d.company_name, d.name), d.address, d.location_lat, d.location_lng,
      coalesce(p_ready, case when b.cargo_ready_date is not null then (b.cargo_ready_date + time '09:00') at time zone 'Pacific/Auckland' end),
      case when b.is_dg then 'dangerous' else 'general' end, case when b.is_dg then nullif(concat_ws(' ', 'UN', b.un_number, b.dg_class), 'UN') end,
      left(b.special_instructions, 500), auth.uid())
  returning id, consignment_no into v_id, v_no;

  insert into public.tms_consignment_cargo (consignment_id, type, units, length_cm, width_cm, height_cm, weight_kg, total_cube_m3, sort_order)
  select v_id, 'package', coalesce(l.pieces, 1),
         l.length * case lower(coalesce(l.length_unit, 'cm')) when 'm' then 100 when 'mm' then 0.1 when 'in' then 2.54 else 1 end,
         l.width * case lower(coalesce(l.length_unit, 'cm')) when 'm' then 100 when 'mm' then 0.1 when 'in' then 2.54 else 1 end,
         l.height * case lower(coalesce(l.length_unit, 'cm')) when 'm' then 100 when 'mm' then 0.1 when 'in' then 2.54 else 1 end,
         l.weight * case lower(coalesce(l.weight_unit, 'kg')) when 'lb' then 0.453592 when 't' then 1000 else 1 end,
         l.cbm, l.ord
    from public.booking_cargo_lines l where l.booking_id = p_booking order by l.ord;
  get diagnostics n = row_count;
  if n = 0 and (b.pieces is not null or b.gross_weight_kg is not null) then
    insert into public.tms_consignment_cargo (consignment_id, type, units, weight_kg, total_cube_m3, sort_order)
    values (v_id, 'package', coalesce(b.pieces, 1), coalesce(b.gross_weight_kg, b.weight_kg), coalesce(b.cbm, b.volume_m3), 0);
  end if;

  insert into public.tms_events (consignment_id, event_code, to_status, note, actor)
  values (v_id, 'created', 'unassigned', 'Pickup created from booking ' || b.booking_ref, auth.uid());
  insert into public.inbox_messages (conversation_id, channel, kind, sender_kind, sender_user_id, sender_name, body)
  select c.id, 'internal', 'event', 'staff', auth.uid(), public.inbox_staff_name(auth.uid()), 'Pickup ' || v_no || ' created for ' || b.booking_ref
    from public.inbox_conversations c where c.booking_id = p_booking;
  return jsonb_build_object('id', v_id, 'consignment_no', v_no, 'existing', false);
end $$;

grant execute on function public.booking_create_pickup(uuid, timestamptz) to authenticated;

-- Actuals from every checked-in consignment of the booking replace its cargo lines; totals + air chargeable follow.
create or replace function public.booking_sync_checkin(p_booking uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_pcs numeric; v_kg numeric; v_cbm numeric; v_old text; b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null then return; end if;
  select sum(coalesce(cc.actual_units, cc.units)), sum(coalesce(cc.actual_weight_kg, cc.weight_kg)), sum(coalesce(cc.actual_total_cube_m3, cc.total_cube_m3))
    into v_pcs, v_kg, v_cbm
    from public.tms_consignment_cargo cc join public.tms_consignments c on c.id = cc.consignment_id
   where c.booking_id = p_booking and c.wms_checkin_at is not null and c.status not in ('cancel', 'archived');
  if coalesce(v_pcs, 0) = 0 and coalesce(v_kg, 0) = 0 then return; end if;
  v_old := concat_ws(' ', b.pieces || ' pcs', b.gross_weight_kg || ' kg', b.cbm || ' m3');

  delete from public.booking_cargo_lines where booking_id = p_booking;
  insert into public.booking_cargo_lines (booking_id, ord, pieces, length_unit, length, width, height, cbm, weight_unit, weight, goods_desc)
  select p_booking, row_number() over (order by c.wms_checkin_at, cc.sort_order) - 1, coalesce(cc.actual_units, cc.units)::int, 'cm',
         coalesce(cc.actual_length_cm, cc.length_cm), coalesce(cc.actual_width_cm, cc.width_cm), coalesce(cc.actual_height_cm, cc.height_cm),
         coalesce(cc.actual_total_cube_m3, cc.total_cube_m3), 'kg', coalesce(cc.actual_weight_kg, cc.weight_kg), b.goods_description
    from public.tms_consignment_cargo cc join public.tms_consignments c on c.id = cc.consignment_id
   where c.booking_id = p_booking and c.wms_checkin_at is not null and c.status not in ('cancel', 'archived');

  update public.bookings set pieces = v_pcs::int, gross_weight_kg = v_kg, weight_kg = v_kg, cbm = v_cbm, volume_m3 = v_cbm,
         chargeable_weight_kg = case when module in ('EA', 'IA') then round(greatest(coalesce(v_kg, 0), coalesce(v_cbm, 0) * 167), 1) else chargeable_weight_kg end,
         updated_at = now()
   where id = p_booking;
  insert into public.inbox_messages (conversation_id, channel, kind, sender_kind, sender_name, body)
  select c.id, 'internal', 'event', 'system', 'Warehouse',
         'Checked in: ' || concat_ws(' ', round(v_pcs) || ' pcs', round(v_kg, 1) || ' kg', round(v_cbm, 3) || ' m3')
         || case when v_old <> '' then ' (booked ' || v_old || ')' else '' end
    from public.inbox_conversations c where c.booking_id = p_booking;
end $$;

create or replace function public.trg_tms_checkin_to_booking()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_booking uuid; v_in timestamptz;
begin
  if tg_table_name = 'tms_consignments' then
    if new.booking_id is not null and new.wms_checkin_at is not null and new.wms_checkin_at is distinct from old.wms_checkin_at then
      perform public.booking_sync_checkin(new.booking_id);
    end if;
  else
    select booking_id, wms_checkin_at into v_booking, v_in from public.tms_consignments where id = new.consignment_id;
    if v_booking is not null and v_in is not null then perform public.booking_sync_checkin(v_booking); end if;
  end if;
  return new;
end $$;

create or replace trigger trg_tms_checkin_booking after update of wms_checkin_at on public.tms_consignments
  for each row execute function public.trg_tms_checkin_to_booking();
create or replace trigger trg_tms_cargo_actuals_booking after update of actual_units, actual_weight_kg, actual_total_cube_m3 on public.tms_consignment_cargo
  for each row when (new.actual_units is distinct from old.actual_units or new.actual_weight_kg is distinct from old.actual_weight_kg
                     or new.actual_total_cube_m3 is distinct from old.actual_total_cube_m3)
  execute function public.trg_tms_checkin_to_booking();

create or replace function public.trg_booking_confirm_pickup()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' and new.source = 'customer_portal'
     and new.module in ('EA', 'ES') and nullif(btrim(coalesce(new.pickup_address, '')), '') is not null then
    perform public.booking_create_pickup(new.id, null);
  end if;
  return new;
end $$;

create or replace trigger trg_booking_confirm_pickup after update of status on public.bookings
  for each row execute function public.trg_booking_confirm_pickup();

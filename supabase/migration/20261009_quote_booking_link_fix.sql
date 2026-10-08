-- Fix 9 Oct 2026: never write bookings.quoted_rate (portal snapshot shape). Repo parity: do not re-run.

create or replace function public.quote_booking_link(p_quote uuid, p_booking uuid, p_response uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q quotes%rowtype; b bookings%rowtype; v_resp uuid;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into q from quotes where id = p_quote for update;
  if not found then raise exception 'Quote not found'; end if;
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception 'Booking not found'; end if;
  if q.booking_id is not null and q.booking_id <> p_booking then
    raise exception 'Quote % is already linked to another booking', q.quote_no; end if;
  if b.quote_id is not null and b.quote_id <> p_quote then
    raise exception 'Booking already linked to a quote. Unlink first.'; end if;
  v_resp := coalesce(p_response, quote_latest_response(p_quote));

  update bookings set quote_id = p_quote, quote_response_id = v_resp where id = p_booking;
  update quotes set booking_id = p_booking where id = p_quote;

  insert into booking_history (booking_id, field, old_value, new_value, action, actor_id, actor_name)
  select p_booking, 'quote', null, q.quote_no, 'quote_linked', su.user_id, su.email
  from (select auth.uid() uid) x left join staff_users su on su.user_id = x.uid;

  return jsonb_build_object('quote_id', p_quote, 'quote_no', q.quote_no, 'response_id', v_resp);
end $$;

create or replace function public.booking_create_from_quote(p_quote uuid, p_response uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q quotes%rowtype; v_resp uuid; v_id uuid; v_ref text; v_ctype text; v_ccount int; v_lt text;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into q from quotes where id = p_quote for update;
  if not found then raise exception 'Quote not found'; end if;
  if q.booking_id is not null then raise exception 'Quote already has a booking'; end if;
  if q.status <> 'won' then raise exception 'Only won quotes can become bookings'; end if;
  if q.shipment_mode <> 'sea' or coalesce(q.movement_type, '') <> 'import' then
    raise exception 'Only Import Sea quotes can create bookings for now'; end if;
  if q.customer_account_id is null then raise exception 'Quote has no customer account'; end if;

  v_resp := coalesce(p_response, quote_latest_response(p_quote));
  v_lt := case when upper(q.shipment_type) in ('FCL','LCL') then upper(q.shipment_type) end;
  select string_agg(distinct coalesce(container_size,'') || coalesce(container_type,''), ', '), sum(qty)::int
    into v_ctype, v_ccount from quote_containers where quote_id = p_quote;

  insert into bookings (module, mode, source, status, account_id, importer_account_id, consignee_account_id,
    importer_name, origin, destination, incoterm, load_type, container_type, container_count,
    shipper_name, shipper_address, consignee_name, consignee_address, customer_ref,
    is_dg, un_number, dg_class, needs_insurance, cargo_value, cargo_value_currency,
    is_consolidation, is_temp_controlled, is_valuable, is_oog,
    quote_id, quote_response_id, created_by)
  values ('IS', 'sea_import', 'quote', 'new', q.customer_account_id, q.customer_account_id, q.customer_account_id,
    q.customer_name, q.from_port_code, q.to_port_code, q.incoterms, v_lt, v_ctype, v_ccount,
    q.shipper, q.shipper_address, q.consignee, q.consignee_address, q.customer_po,
    coalesce(q.is_hazardous, false), q.dg_un_number, q.dg_class, q.need_insurance, q.cargo_value, q.cargo_value_currency,
    false, coalesce(q.need_refrigeration, false), false, false,
    p_quote, v_resp, auth.uid())
  returning id, booking_ref into v_id, v_ref;

  update quotes set booking_id = v_id where id = p_quote;
  insert into booking_history (booking_id, field, old_value, new_value, action, actor_id, actor_name)
  select v_id, 'quote', null, q.quote_no, 'created_from_quote', su.user_id, su.email
  from (select auth.uid() uid) x left join staff_users su on su.user_id = x.uid;

  return jsonb_build_object('id', v_id, 'booking_ref', v_ref);
end $$;

notify pgrst, 'reload schema';

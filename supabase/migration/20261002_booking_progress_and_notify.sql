-- Booking progress panel + customer notify.
--  booking_progress(p_booking)          milestones with done/late state, dates, owner, plus flow next action.
--  booking_customer_contacts(p_booking) who we can reach: emails, opted-in WhatsApp, portal users, existing thread.
--  staff_booking_message_post(...)      post a staff message to the booking's portal thread (creates one if none).
-- Staff only. Idempotent.

create or replace function public.booking_progress(p_booking uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $fn$
declare
  b record; f record; c record; v_eta date; v_ms jsonb := '[]'::jsonb; v_is_import boolean; v_fcl boolean;
  v_arrived_at timestamptz; v_returned int := 0; v_return_at timestamptz; v_deliv boolean;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into b from bookings where id = p_booking;
  if not found then return null; end if;
  select * into f from v_booking_flow where booking_id = p_booking;
  v_is_import := b.module in ('IS', 'IA');
  v_eta := case when b.module = 'IS' then import_sea_booking_eta(p_booking) else coalesce(f.eta, b.eta) end;

  select count(bc.*) n,
         count(ct.inbound_ata) n_arr, min(ct.inbound_ata) arr_at,
         count(ct.discharged_at) n_disc, max(ct.discharged_at) disc_at,
         count(*) filter (where ct.customs_release_at is not null and ct.mpi_release_at is not null) n_clear,
         max(greatest(ct.customs_release_at, ct.mpi_release_at)) clear_at,
         count(ct.line_release_at) n_line, max(ct.line_release_at) line_at,
         count(coalesce(ct.gate_out_at, ct.delivered_at)) n_out, max(coalesce(ct.gate_out_at, ct.delivered_at)) out_at,
         min(ct.last_free_at)::date lfd, max(ct.empty_return_depot_name) depot
    into c
    from booking_containers bc
    left join container_tracking ct on ct.booking_id = bc.booking_id and upper(ct.container_no) = upper(bc.container_no)
   where bc.booking_id = p_booking;

  v_fcl := c.n > 0 and coalesce(b.load_type, 'FCL') = 'FCL';
  select count(distinct upper(e.container_no)), max(e.event_datetime) into v_returned, v_return_at
    from tracking_events e
   where e.booking_id = p_booking
     and ((e.source = 'seavantage' and e.event_type_code = 'RD' and coalesce(e.is_estimated, false) = false)
       or (e.source = 'carrier' and e.event_type_code = 'GTIN' and e.raw->>'emptyIndicatorCode' = 'EMPTY'
           and e.event_datetime::date >= coalesce(v_eta - 2, '1900-01-01'::date)));
  v_arrived_at := coalesce(c.arr_at, f.arrived::timestamptz);
  -- Delivered (tracked gate-out, or a manual delivery date already passed) implies the earlier physical steps.
  v_deliv := (c.n > 0 and c.n_out >= c.n) or coalesce(b.delivery_date <= current_date, false);

  -- key, label, done, at, due, owner (ubf | customer | carrier | port), note
  v_ms := jsonb_build_array(
    jsonb_build_object('key','confirmed','label','Booking confirmed','owner','ubf',
      'done', coalesce(f.stage, 'request') <> 'request', 'at', b.created_at),
    jsonb_build_object('key','erp','label','Job in CyberFreight','owner','ubf',
      'done', b.shipment_id is not null, 'at', b.erp_ref_confirmed_at, 'note', b.job_no));

  if b.module = 'IS' then
    v_ms := v_ms || jsonb_build_array(
      jsonb_build_object('key','release','label','Seaway bill / telex','owner','customer',
        'done', coalesce(b.swb_released, false) or coalesce(b.tlx_release_on_hand, false),
        'due', v_eta - 2, 'note', case when b.swb_released then 'Seaway bill' when b.tlx_release_on_hand then 'Telex on hand' end),
      jsonb_build_object('key','arrived','label','Vessel arrived','owner','carrier',
        'done', v_arrived_at is not null or v_deliv, 'at', v_arrived_at, 'due', v_eta,
        'note', coalesce(b.vessel, (select max(inbound_vessel_name) from container_tracking where booking_id = p_booking))));
    if c.n > 0 then
      v_ms := v_ms || jsonb_build_array(
        jsonb_build_object('key','discharged','label','Discharged','owner','port',
          'done', c.n_disc >= c.n or v_deliv, 'at', c.disc_at, 'note', case when c.n > 1 then c.n_disc || ' of ' || c.n end));
    end if;
    v_ms := v_ms || jsonb_build_array(
      jsonb_build_object('key','cleared','label','Customs and MPI cleared','owner','ubf',
        'done', (c.n > 0 and c.n_clear >= c.n) or coalesce(b.cleared, false), 'at', c.clear_at, 'due', v_eta,
        'note', case when c.n > 1 and c.n_clear < c.n then c.n_clear || ' of ' || c.n end));
    if c.n > 0 then
      v_ms := v_ms || jsonb_build_array(
        jsonb_build_object('key','line','label','Line released','owner','customer',
          'done', c.n_line >= c.n, 'at', c.line_at, 'due', v_eta,
          'note', case when c.n > 1 and c.n_line < c.n then c.n_line || ' of ' || c.n end));
    end if;
    v_ms := v_ms || jsonb_build_array(
      jsonb_build_object('key','cartage','label','Cartage booked','owner','ubf',
        'done', coalesce(f.cartage_booked, false) or coalesce(b.truck_booked, false) or v_deliv,
        'due', coalesce(c.lfd, b.last_free_day) - 1, 'note', f.tms_no),
      jsonb_build_object('key','delivered','label','Delivered','owner','ubf',
        'done', v_deliv,
        'at', coalesce(c.out_at, b.delivery_date::timestamptz), 'due', coalesce(c.lfd, b.last_free_day),
        'note', case when c.n > 1 and c.n_out < c.n then c.n_out || ' of ' || c.n end));
    if v_fcl then
      v_ms := v_ms || jsonb_build_array(
        jsonb_build_object('key','empty','label','Empty returned','owner','customer',
          'done', v_returned >= c.n, 'at', v_return_at,
          'note', coalesce(case when c.n > 1 then v_returned || ' of ' || c.n end, c.depot)));
    end if;
  else
    v_ms := v_ms || jsonb_build_array(
      jsonb_build_object('key','departed','label', case when v_is_import then 'Departed origin' else 'Departed' end, 'owner','carrier',
        'done', f.departed is not null, 'at', f.departed, 'due', f.etd),
      jsonb_build_object('key','arrived','label','Arrived','owner','carrier',
        'done', f.arrived is not null, 'at', f.arrived, 'due', coalesce(f.eta, b.eta)),
      jsonb_build_object('key','delivered','label','Delivered','owner','ubf',
        'done', f.delivered is not null, 'at', f.delivered));
  end if;

  v_ms := v_ms || jsonb_build_array(
    jsonb_build_object('key','invoiced','label','Invoice sent','owner','ubf',
      'done', coalesce(b.inv_sent, false), 'note', case when b.inv_approved and not coalesce(b.inv_sent, false) then 'Approved, not sent' end));

  -- state: done | late (due passed) | todo
  select jsonb_agg(m || jsonb_build_object('state',
           case when (m->>'done')::boolean then 'done'
                when m->>'due' is not null and (m->>'due')::date < current_date then 'late'
                else 'todo' end) order by ord)
    into v_ms from jsonb_array_elements(v_ms) with ordinality as t(m, ord);

  return jsonb_build_object(
    'booking_id', b.id, 'module', b.module, 'load_type', b.load_type, 'ref', b.booking_ref,
    'stage', f.stage, 'next_action', f.next_action, 'action_due', f.action_due, 'urgency', f.urgency,
    'eta', v_eta, 'lfd', coalesce(c.lfd, b.last_free_day), 'depot', c.depot, 'containers', c.n,
    'delivery_date', b.delivery_date, 'delivery_mode', b.delivery_mode, 'hold', (select label from hold_reasons where code = b.hold_code),
    'milestones', v_ms,
    'done', (select count(*) from jsonb_array_elements(v_ms) x where x->>'state' = 'done'),
    'total', jsonb_array_length(v_ms));
end
$fn$;

create or replace function public.booking_customer_contacts(p_booking uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $fn$
declare b record;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select id, account_id, consignee_email, consignee_contact, handled_by into b from bookings where id = p_booking;
  if not found then return null; end if;
  return jsonb_build_object(
    'account_id', b.account_id,
    'customer_name', (select name from customers where account_id = b.account_id),
    'emails', coalesce((
      select jsonb_agg(x order by x.rank, x.name) from (
        select distinct on (lower(email)) email, name, source, rank from (
          select pu.email, coalesce(pu.display_name, split_part(pu.email, '@', 1)) as name, 'portal' as source, 1 as rank
            from portal_users pu where pu.account_id = b.account_id and pu.status = 'active' and pu.email is not null
          union all
          select ct.email, btrim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')), 'prime contact', 2
            from contacts ct where ct.account_id = b.account_id and ct.is_prime and ct.email like '%@%'
          union all
          select cu.email, coalesce(cu.contact, cu.name), 'customer', 3
            from customers cu where cu.account_id = b.account_id and cu.email like '%@%'
          union all
          select b.consignee_email, coalesce(b.consignee_contact, 'Consignee'), 'consignee', 4
            where b.consignee_email like '%@%'
        ) e order by lower(email), rank
      ) x), '[]'::jsonb),
    'whatsapp', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'name', coalesce(w.display_name, 'Contact'),
               'number', '••••' || right(w.wa_id, 4)))
        from whatsapp_contacts w where w.account_id = b.account_id and w.opted_in), '[]'::jsonb),
    'portal_users', (select count(*) from portal_users pu where pu.account_id = b.account_id and pu.status = 'active'),
    'thread_id', (select id from portal_threads t where t.booking_id = b.id order by last_message_at desc limit 1),
    'reply_to', (select email from staff_users where user_id = coalesce(b.handled_by, auth.uid())));
end
$fn$;

create or replace function public.staff_booking_message_post(p_booking uuid, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = public
as $fn$
declare v_thread uuid; v_account text; v_module text; v_ref text;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select account_id, module, booking_ref into v_account, v_module, v_ref from bookings where id = p_booking;
  if v_account is null then raise exception 'Booking has no customer account'; end if;
  select id into v_thread from portal_threads where booking_id = p_booking order by last_message_at desc limit 1;
  if v_thread is null then
    insert into portal_threads (account_id, booking_id, module, subject, status, created_by)
    values (v_account, p_booking, v_module, coalesce(nullif(btrim(p_subject), ''), 'Booking ' || coalesce(v_ref, '')), 'open', auth.uid())
    returning id into v_thread;
  else
    update portal_threads set status = 'open' where id = v_thread and status <> 'open';
  end if;
  perform staff_message_send(v_thread, p_body);
  return v_thread;
end
$fn$;

revoke all on function public.booking_progress(uuid) from public, anon;
revoke all on function public.booking_customer_contacts(uuid) from public, anon;
revoke all on function public.staff_booking_message_post(uuid, text, text) from public, anon;
grant execute on function public.booking_progress(uuid) to authenticated;
grant execute on function public.booking_customer_contacts(uuid) to authenticated;
grant execute on function public.staff_booking_message_post(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

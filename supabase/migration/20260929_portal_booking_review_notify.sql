-- Portal booking requests, staff side:
--   * staff_review_portal_booking(): Confirm / Decline (with reason) from the console
--   * portal_booking_notify_payload(): data for the portal-booking-notify edge function (service role only)
--   * trigger: new request -> email the module inbox; confirmed / declined / linked to ERP -> email the requester
--   * portal_bookings view gains decline_reason
-- Idempotent.

alter table public.bookings add column if not exists decline_reason text;

-- One row per email sent, so each goes once. Kept off bookings so booking history stays clean.
create table if not exists public.portal_booking_notifications (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event text not null,
  recipient text,
  sent_at timestamptz not null default now(),
  primary key (booking_id, event)
);
alter table public.portal_booking_notifications enable row level security;
drop policy if exists pbn_staff_read on public.portal_booking_notifications;
create policy pbn_staff_read on public.portal_booking_notifications for select to authenticated using (public.is_staff());

-- Confirm or decline a customer portal request.
create or replace function public.staff_review_portal_booking(p_booking uuid, p_action text, p_reason text default null)
returns table (new_status text, reason text)
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings%rowtype;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.source <> 'customer_portal' then raise exception 'Only customer portal requests can be reviewed here'; end if;
  if b.shipment_id is not null then raise exception 'Already linked to an ERP shipment'; end if;

  if p_action = 'confirm' then
    if b.status not in ('submitted', 'new', 'parsed', 'rejected') then raise exception 'Booking is already %', b.status; end if;
    update public.bookings set status = 'confirmed', decline_reason = null
      where id = p_booking;
  elsif p_action = 'decline' then
    if coalesce(trim(p_reason), '') = '' then raise exception 'Give the customer a reason'; end if;
    if b.status in ('entered', 'synced', 'rejected') then raise exception 'Booking is already %', b.status; end if;
    update public.bookings set status = 'rejected', decline_reason = trim(p_reason)
      where id = p_booking;
  else
    raise exception 'Unknown action %', p_action;
  end if;

  return query select bk.status, bk.decline_reason from public.bookings bk where bk.id = p_booking;
end $$;

revoke all on function public.staff_review_portal_booking(uuid, text, text) from public, anon;
grant execute on function public.staff_review_portal_booking(uuid, text, text) to authenticated;

-- Everything the notify function needs, in one call. Service role only (also used as its auth probe).
create or replace function public.portal_booking_notify_payload(p_booking uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'booking_ref', b.booking_ref, 'module', b.module, 'load_type', b.load_type, 'status', b.status,
    'origin', b.origin, 'destination', b.destination, 'incoterm', b.incoterm,
    'cargo_ready_date', b.cargo_ready_date, 'etd', b.etd,
    'goods', coalesce(b.goods_description, b.commodity), 'pieces', b.pieces, 'packing', b.packing_type,
    'weight_kg', coalesce(b.gross_weight_kg, b.weight_kg), 'cbm', coalesce(b.cbm, b.volume_m3),
    'container_type', b.container_type, 'container_count', b.container_count,
    'is_dg', b.is_dg, 'is_temp', b.is_temp_controlled, 'notes', b.special_instructions,
    'customer_ref', b.customer_ref, 'decline_reason', b.decline_reason,
    'account_id', b.account_id, 'customer_name', c.name,
    'requester_email', u.email,
    'sent', coalesce((select jsonb_agg(n.event) from public.portal_booking_notifications n where n.booking_id = b.id), '[]'::jsonb),
    'shipment', case when s.job_unique is null then null else jsonb_build_object(
      'job_unique', s.job_unique,
      'number', case when s.module like 'FI%' then s.module || '-' || s.shipment_no
                       || case when coalesce(s.job_no, 1) > 1 then '/' || s.job_no else '' end
                     else coalesce(s.job_no::text, s.consol_key) end) end,
    'duplicate', (select jsonb_build_object('job_unique', m.job_unique, 'consol_key', m.consol_key, 'score', m.score, 'reasons', m.reasons)
                  from public.booking_shipment_candidates(b.id) m order by m.score desc limit 1)
  )
  from public.bookings b
  left join public.customers c on c.account_id = b.account_id
  left join auth.users u on u.id = b.requested_by
  left join public.shipments s on s.job_unique = b.shipment_id
  where b.id = p_booking
$$;

revoke all on function public.portal_booking_notify_payload(uuid) from public, anon, authenticated;
grant execute on function public.portal_booking_notify_payload(uuid) to service_role;

-- Queue an email through pg_net. Never blocks or fails the booking write.
create or replace function public.portal_booking_notify_queue(p_booking uuid, p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-booking-notify',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := jsonb_build_object('booking_id', p_booking, 'event', p_event)
  );
exception when others then
  raise warning 'portal booking notify not queued: %', sqlerrm;
end $$;

revoke all on function public.portal_booking_notify_queue(uuid, text) from public, anon, authenticated;

create or replace function public.bookings_portal_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source is distinct from 'customer_portal' then return new; end if;
  if tg_op = 'INSERT' then
    perform public.portal_booking_notify_queue(new.id, 'new_request');
  elsif new.shipment_id is not null and old.shipment_id is null then
    perform public.portal_booking_notify_queue(new.id, 'in_erp');
  elsif new.status is distinct from old.status and new.status in ('confirmed', 'rejected') then
    perform public.portal_booking_notify_queue(new.id, case when new.status = 'confirmed' then 'confirmed' else 'declined' end);
  end if;
  return new;
end $$;

drop trigger if exists trg_bookings_portal_notify on public.bookings;
create trigger trg_bookings_portal_notify
  after insert or update of status, shipment_id on public.bookings
  for each row execute function public.bookings_portal_notify();

-- Customers see why a request was declined.
create or replace view public.portal_bookings as
 select id, shipment_id, delivery_date, updated_at, booking_ref, module, mode, load_type, status, source, created_at,
    origin, destination, etd, coalesce(m_eta, eta) as eta, vessel, voyage, incoterm, commodity, goods_description,
    pieces, packing_type, coalesce(gross_weight_kg, weight_kg) as weight_kg, coalesce(cbm, volume_m3) as cbm,
    container_type, container_count, cargo_ready_date, is_dg, special_instructions, shipper_address,
    consignee_name, consignee_address, mbl_no,
    case
      when status = 'rejected' then 'declined'
      when shipment_id is not null or status in ('entered', 'synced') then 'in_erp'
      when status in ('confirmed', 'sli_requested', 'sli_received', 'xml_ready') then 'confirmed'
      else 'requested'
    end as portal_status,
    customer_ref,
    decline_reason
   from public.bookings b
  where archived_at is null
    and (status <> 'draft' or source = 'customer_portal')
    and (public.my_account_id() = account_id or public.my_account_id() = consignee_account_id or public.my_account_id() = importer_account_id);

notify pgrst, 'reload schema';

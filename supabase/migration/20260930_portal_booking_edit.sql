-- Portal: customers edit their booking until the shipment exists.
-- Run once in Supabase Dashboard > SQL Editor (project cpnkudbdzgnzmodhsrbf). Safe to re-run.

alter table public.bookings add column if not exists customer_edited_at timestamptz;

-- Everything the edit form needs, for the signed-in account's own booking.
create or replace function public.portal_booking_get(p_booking uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', b.id, 'booking_ref', b.booking_ref, 'mode', b.mode, 'load_type', b.load_type, 'status', b.status,
    'shipment_id', b.shipment_id, 'quote_id', b.quote_id, 'quote_response_id', b.quote_response_id,
    'origin', b.origin, 'destination', b.destination, 'incoterm', b.incoterm, 'cargo_ready_date', b.cargo_ready_date,
    'goods_description', coalesce(b.goods_description, b.commodity), 'hs_code', b.hs_code,
    'pieces', b.pieces, 'packing_type', b.packing_type, 'weight_kg', coalesce(b.gross_weight_kg, b.weight_kg), 'cbm', coalesce(b.cbm, b.volume_m3),
    'container_type', b.container_type, 'container_count', b.container_count,
    'is_dg', b.is_dg, 'un_number', b.un_number, 'dg_class', b.dg_class, 'is_temp_controlled', b.is_temp_controlled, 'temp_range', b.temp_range,
    'shipper', jsonb_build_object('company', b.shipper_name, 'contact_name', b.shipper_contact, 'address', b.shipper_address, 'city', b.shipper_city,
      'postcode', b.shipper_postcode, 'country', b.shipper_country, 'phone', b.shipper_phone, 'email', b.shipper_email),
    'consignee', jsonb_build_object('company', b.consignee_name, 'contact_name', b.consignee_contact, 'address', b.consignee_address, 'city', b.consignee_city,
      'postcode', b.consignee_postcode, 'country', b.consignee_country, 'phone', b.consignee_phone, 'email', b.consignee_email),
    'pickup_address', b.pickup_address, 'delivery_address', b.delivery_address,
    'needs_customs', b.needs_customs, 'needs_insurance', b.needs_insurance, 'cargo_value', b.cargo_value, 'cargo_value_currency', b.cargo_value_currency,
    'customer_ref', b.customer_ref, 'notes', b.special_instructions,
    'editable', b.shipment_id is null and b.archived_at is null and coalesce(b.status, '') not in ('rejected', 'entered', 'synced')
  )
  from public.bookings b
  where b.id = p_booking and b.source = 'customer_portal'
    and public.my_account_id() in (b.account_id, b.consignee_account_id, b.importer_account_id)
$$;

-- Save the customer's changes. Lane and mode stay fixed when the booking came from an approved quote.
create or replace function public.portal_booking_update(p_booking uuid, p jsonb)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  acct text := public.my_account_id();
  b public.bookings;
  shp jsonb := coalesce(p->'shipper', '{}'::jsonb);
  cne jsonb := coalesce(p->'consignee', '{}'::jsonb);
  dir text; md text; lt text; locked boolean;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null or b.source is distinct from 'customer_portal'
     or (acct is distinct from b.account_id and acct is distinct from b.consignee_account_id and acct is distinct from b.importer_account_id) then
    raise exception 'Booking not found';
  end if;
  if b.shipment_id is not null or b.status in ('entered', 'synced') then
    raise exception 'This booking is already a shipment. Message us to change it.';
  end if;
  if b.status = 'rejected' then raise exception 'This booking was declined. Send a new one instead.'; end if;

  locked := b.quote_response_id is not null;
  dir := case when locked then split_part(b.mode, '_', 2) else lower(coalesce(p->>'direction', split_part(b.mode, '_', 2))) end;
  md := case when locked then split_part(b.mode, '_', 1) else lower(coalesce(p->>'mode', split_part(b.mode, '_', 1))) end;
  lt := case when md = 'sea' then upper(coalesce(nullif(p->>'load_type', ''), b.load_type)) end;

  if dir not in ('import', 'export') then raise exception 'Choose import or export'; end if;
  if md not in ('sea', 'air') then raise exception 'Choose sea or air'; end if;
  if md = 'sea' and coalesce(lt, '') not in ('FCL', 'LCL') then raise exception 'Choose FCL or LCL'; end if;
  if coalesce(trim(p->>'goods_description'), '') = '' then raise exception 'Tell us what you are shipping'; end if;
  if dir = 'import' and coalesce(trim(shp->>'company'), '') = '' then raise exception 'Add the shipper (who sends the goods)'; end if;
  if dir = 'export' and coalesce(trim(cne->>'company'), '') = '' then raise exception 'Add the consignee (who receives the goods)'; end if;

  update public.bookings set
    module = case when md = 'sea' and dir = 'import' then 'IS' when md = 'sea' then 'ES' when dir = 'import' then 'IA' else 'EA' end,
    mode = md || '_' || dir,
    load_type = lt,
    consignee_account_id = case when dir = 'import' then acct end,
    importer_account_id = case when dir = 'import' then acct end,
    origin = case when locked then b.origin else upper(trim(coalesce(nullif(p->>'origin', ''), b.origin))) end,
    destination = case when locked then b.destination else upper(trim(coalesce(nullif(p->>'destination', ''), b.destination))) end,
    incoterm = nullif(p->>'incoterm', ''),
    cargo_ready_date = nullif(p->>'cargo_ready_date', '')::date,
    goods_description = nullif(trim(p->>'goods_description'), ''),
    commodity = nullif(trim(p->>'goods_description'), ''),
    hs_code = nullif(trim(p->>'hs_code'), ''),
    pieces = nullif(p->>'pieces', '')::numeric,
    packing_type = nullif(p->>'packing_type', ''),
    gross_weight_kg = nullif(p->>'weight_kg', '')::numeric,
    cbm = nullif(p->>'cbm', '')::numeric,
    container_type = case when lt = 'FCL' then nullif(p->>'container_type', '') end,
    container_count = case when lt = 'FCL' then nullif(p->>'container_count', '')::int end,
    is_dg = coalesce((p->>'is_dg')::boolean, false),
    un_number = nullif(p->>'un_number', ''),
    dg_class = nullif(p->>'dg_class', ''),
    is_temp_controlled = coalesce((p->>'is_temp_controlled')::boolean, false),
    temp_range = nullif(p->>'temp_range', ''),
    shipper_name = nullif(trim(shp->>'company'), ''), shipper_contact = nullif(trim(shp->>'contact_name'), ''),
    shipper_address = nullif(trim(shp->>'address'), ''), shipper_city = nullif(trim(shp->>'city'), ''),
    shipper_postcode = nullif(trim(shp->>'postcode'), ''), shipper_country = nullif(trim(coalesce(shp->>'country_code', shp->>'country')), ''),
    shipper_phone = nullif(trim(shp->>'phone'), ''), shipper_email = nullif(trim(shp->>'email'), ''),
    consignee_name = nullif(trim(cne->>'company'), ''), consignee_contact = nullif(trim(cne->>'contact_name'), ''),
    consignee_address = nullif(trim(cne->>'address'), ''), consignee_city = nullif(trim(cne->>'city'), ''),
    consignee_postcode = nullif(trim(cne->>'postcode'), ''), consignee_country = nullif(trim(coalesce(cne->>'country_code', cne->>'country')), ''),
    consignee_phone = nullif(trim(cne->>'phone'), ''), consignee_email = nullif(trim(cne->>'email'), ''),
    pickup_address = nullif(trim(p->>'pickup_address'), ''),
    delivery_address = nullif(trim(p->>'delivery_address'), ''),
    needs_customs = (p->>'needs_customs')::boolean,
    needs_insurance = (p->>'needs_insurance')::boolean,
    cargo_value = nullif(p->>'cargo_value', '')::numeric,
    cargo_value_currency = nullif(p->>'cargo_value_currency', ''),
    customer_ref = nullif(trim(p->>'customer_ref'), ''),
    special_instructions = nullif(trim(p->>'notes'), ''),
    customer_edited_at = now()
  where id = b.id;

  return b.booking_ref;
end $$;

revoke all on function public.portal_booking_get(uuid), public.portal_booking_update(uuid, jsonb) from public, anon;
grant execute on function public.portal_booking_get(uuid), public.portal_booking_update(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

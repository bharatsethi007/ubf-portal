-- Quote <-> Booking link (Phase 1). Applied via MCP 9 Oct 2026. Repo parity: do not re-run.

alter table public.bookings drop constraint if exists bookings_source_check;
alter table public.bookings add constraint bookings_source_check
  check (source = any (array['manual','email_parsed','email_import','customer_portal','quote']));

create unique index if not exists bookings_quote_id_uniq on public.bookings(quote_id) where quote_id is not null;
create index if not exists quotes_booking_id_idx on public.quotes(booking_id) where booking_id is not null;

create or replace function public.quote_rate_snapshot(p_response uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'response_id', r.id, 'response_no', r.response_no, 'carrier', r.carrier,
    'currency', r.currency, 'total_sell', r.total_sell, 'total_buy', r.total_buy,
    'net_profit', r.net_profit, 'margin_pct', r.margin_pct, 'valid_till', r.valid_till)
  from quote_responses r where r.id = p_response
$$;

create or replace function public.quote_latest_response(p_quote uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from quote_responses where quote_id = p_quote
  order by coalesce(sent_to_portal_at, updated_at, created_at) desc limit 1
$$;

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

create or replace function public.quote_booking_unlink(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_q uuid; v_no text;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select quote_id into v_q from bookings where id = p_booking for update;
  if v_q is null then return; end if;
  select quote_no into v_no from quotes where id = v_q;
  update bookings set quote_id = null, quote_response_id = null where id = p_booking;
  update quotes set booking_id = null where id = v_q and booking_id = p_booking;
  insert into booking_history (booking_id, field, old_value, new_value, action, actor_id, actor_name)
  select p_booking, 'quote', v_no, null, 'quote_unlinked', su.user_id, su.email
  from (select auth.uid() uid) x left join staff_users su on su.user_id = x.uid;
end $$;

drop function if exists public.quote_link_suggestions(uuid, boolean, boolean, text, int);
create or replace function public.quote_link_suggestions(
  p_booking uuid, p_include_open boolean default false, p_include_lost boolean default false,
  p_search text default null, p_limit int default 25)
returns table(id uuid, quote_no text, status text, customer_name text, customer_account_id text,
  from_port_code text, to_port_code text, shipment_mode text, shipment_type text, movement_type text,
  created_at timestamptz, currency text, total_sell numeric, score int)
language plpgsql stable security definer set search_path = public as $$
declare b bookings%rowtype; v_status text[]; v_sql text; v_q text := nullif(trim(p_search), '');
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into b from bookings where bookings.id = p_booking;
  v_status := array['won'];
  if p_include_open then v_status := v_status || array['open','published','sent']; end if;
  if p_include_lost then v_status := v_status || array['lost','crosswin']; end if;

  v_sql := $q$
    select q.id, q.quote_no, q.status, q.customer_name, q.customer_account_id,
      q.from_port_code, q.to_port_code, q.shipment_mode, q.shipment_type, q.movement_type, q.created_at,
      r.currency, r.total_sell,
      ( case when q.customer_account_id in ($2, $3) then 50 else 0 end
      + case when q.from_port_code = $4 then 20 else 0 end
      + case when q.to_port_code = $5 then 15 else 0 end
      + case when upper(q.shipment_type) = $6 then 10 else 0 end
      + case when q.shipment_mode = 'sea' and q.movement_type = 'import' then 10 else 0 end
      + case when q.created_at > now() - interval '60 days' then 5 else 0 end )::int as score
    from quotes q
    left join lateral (select currency, total_sell from quote_responses r
      where r.quote_id = q.id order by coalesce(sent_to_portal_at, updated_at, created_at) desc limit 1) r on true
    where q.booking_id is null and q.status = any($1) $q$;
  if v_q is not null then
    v_sql := v_sql || $q$ and (q.quote_no ilike '%'||$7||'%' or q.customer_name ilike '%'||$7||'%'
      or q.from_port_code ilike '%'||$7||'%' or q.to_port_code ilike '%'||$7||'%'
      or q.shipper ilike '%'||$7||'%' or q.consignee ilike '%'||$7||'%') $q$;
  end if;
  v_sql := v_sql || ' order by score desc, q.created_at desc limit $8';

  return query execute v_sql using v_status, b.account_id, b.importer_account_id,
    b.origin, coalesce(b.destination, b.m_discharge_port), upper(b.load_type), v_q, p_limit;
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

revoke all on function public.quote_booking_link(uuid, uuid, uuid), public.quote_booking_unlink(uuid),
  public.quote_link_suggestions(uuid, boolean, boolean, text, int), public.booking_create_from_quote(uuid, uuid),
  public.quote_rate_snapshot(uuid), public.quote_latest_response(uuid) from public, anon;
grant execute on function public.quote_booking_link(uuid, uuid, uuid), public.quote_booking_unlink(uuid),
  public.quote_link_suggestions(uuid, boolean, boolean, text, int), public.booking_create_from_quote(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';

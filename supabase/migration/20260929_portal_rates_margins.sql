-- Customer rate search on the portal, priced by margin rules. Buy rates never leave the database.
--   * rate_margin_rules: default margin per product (FCL / LCL / AIR) + per-customer overrides (staff-managed)
--   * rate_sell(): one place that turns a buy rate into a sell rate
--       customer rule > line sell > line markup > card markup > default rule > no price (shown as "on request")
--   * portal_search_rates(): customer search, sell prices only, logged to portal_rate_searches
--   * portal_rate_option(): one option by ref, used when booking from a rate
--   * bookings.quoted_rate: snapshot of the rate a customer booked against (server-priced)
--   * portal_request_quote(): lanes without a published rate go to the quotes module
-- Idempotent.

create table if not exists public.rate_margin_rules (
  id uuid primary key default gen_random_uuid(),
  account_id text references public.customers(account_id) on delete cascade,
  product text not null check (product in ('FCL', 'LCL', 'AIR')),
  method text not null check (method in ('pct', 'flat')),
  value numeric not null check (value >= 0),
  min_margin numeric check (min_margin is null or min_margin >= 0),
  active boolean not null default true,
  notes text,
  updated_by uuid references public.staff_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (account_id, product)
);
alter table public.rate_margin_rules enable row level security;
drop policy if exists rmr_staff_all on public.rate_margin_rules;
create policy rmr_staff_all on public.rate_margin_rules for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace function public.rate_margin_rules_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;
drop trigger if exists trg_rate_margin_rules_touch on public.rate_margin_rules;
create trigger trg_rate_margin_rules_touch before insert or update on public.rate_margin_rules
  for each row execute function public.rate_margin_rules_touch();

-- Buy -> sell. Returns null when nothing prices it (the customer sees "price on request").
create or replace function public.rate_sell(
  p_buy numeric, p_product text, p_account text,
  p_line_sell numeric default null, p_line_markup numeric default null, p_card_markup numeric default null
) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  r public.rate_margin_rules%rowtype;
  v numeric;
begin
  if p_buy is null then return null; end if;
  select * into r from public.rate_margin_rules
   where active and product = p_product and account_id = p_account;
  if found then
    v := case when r.method = 'pct' then p_buy * (1 + r.value / 100) else p_buy + r.value end;
    return round(greatest(v, p_buy + coalesce(r.min_margin, 0)), 2);
  end if;
  if p_line_sell is not null then return round(p_line_sell, 2); end if;
  if p_line_markup is not null then return round(p_buy * (1 + p_line_markup / 100), 2); end if;
  if p_card_markup is not null then return round(p_buy * (1 + p_card_markup / 100), 2); end if;
  select * into r from public.rate_margin_rules
   where active and product = p_product and account_id is null;
  if found then
    v := case when r.method = 'pct' then p_buy * (1 + r.value / 100) else p_buy + r.value end;
    return round(greatest(v, p_buy + coalesce(r.min_margin, 0)), 2);
  end if;
  return null;
end $$;
revoke all on function public.rate_sell(numeric, text, text, numeric, numeric, numeric) from public, anon, authenticated;

create table if not exists public.portal_rate_searches (
  id bigint generated always as identity primary key,
  account_id text,
  user_id uuid,
  mode text, load_type text, container_type text,
  origin text, destination text,
  results integer, priced integer,
  searched_at timestamptz not null default now()
);
alter table public.portal_rate_searches enable row level security;
drop policy if exists prs_staff_read on public.portal_rate_searches;
create policy prs_staff_read on public.portal_rate_searches for select to authenticated using (public.is_staff());

-- All customer-visible options for a lane, sell only. ref = '<product>:<line id>'.
create or replace function public.portal_rate_options(p_account text, p_pol text, p_pod text, p_mode text, p_load text, p_container text, p_ref text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  with q as (
    select upper(trim(coalesce(p_pol, ''))) pol, upper(trim(coalesce(p_pod, ''))) pod,
           lower(coalesce(p_mode, 'sea')) md, upper(coalesce(p_load, '')) lt, upper(trim(coalesce(p_container, ''))) ctr
  ),
  live as (
    select c.* from public.rate_cards c
     where c.status in ('active', 'validated') and (c.valid_to is null or c.valid_to >= current_date)
  ),
  opts as (
    select 'FCL:' || l.id as ref, 'FCL' as product, coalesce(c.vendor_name, c.shipping_line_code) as carrier,
           l.container_type, coalesce(l.currency_code, c.currency_code) as currency, 'per container' as unit,
           public.rate_sell(l.base_rate, 'FCL', p_account, l.sell_rate, null, c.default_markup_pct) as sell,
           null::numeric as sell_min, null::jsonb as breaks,
           l.transit_days, l.via, null::text as frequency, least(c.valid_to, l.valid_to) as valid_to,
           l.origin_port_code, l.dest_port_code, c.id as card_id, l.container_type as surcharge_ctr
      from public.rate_card_fcl_lines l join live c on c.id = l.rate_card_id, q
     where c.rate_type = 'fcl' and (l.valid_to is null or l.valid_to >= current_date)
       and ((p_ref is null and q.md = 'sea' and q.lt in ('', 'FCL') and l.dest_port_code = q.pod
             and (l.origin_port_code = q.pol or l.origin_group_code in (select group_code from public.port_group_members where port_code = q.pol))
             and (q.ctr = '' or l.container_type = q.ctr))
            or p_ref = 'FCL:' || l.id)
    union all
    select 'LCL:' || l.id, 'LCL', coalesce(c.vendor_name, c.shipping_line_code), null,
           coalesce(l.currency_code, c.currency_code), 'per W/M (1 m³ or 1,000 kg)',
           public.rate_sell(l.rate_per_wm, 'LCL', p_account, l.sell_per_wm, null, c.default_markup_pct),
           public.rate_sell(l.min_charge, 'LCL', p_account, l.sell_min, null, c.default_markup_pct), null,
           l.transit_days, l.via, l.frequency, least(c.valid_to, l.valid_to),
           l.origin_port_code, l.dest_port_code, c.id, null
      from public.rate_card_lcl_lines l join live c on c.id = l.rate_card_id, q
     where c.rate_type = 'lcl' and (l.valid_to is null or l.valid_to >= current_date)
       and ((p_ref is null and q.md = 'sea' and q.lt in ('', 'LCL') and l.dest_port_code = q.pod
             and (l.origin_port_code = q.pol or l.origin_group_code in (select group_code from public.port_group_members where port_code = q.pol)))
            or p_ref = 'LCL:' || l.id)
    union all
    select 'AIR:' || l.id, 'AIR', coalesce(c.vendor_name, c.shipping_line_code), null,
           coalesce(l.currency_code, c.currency_code), 'per kg (chargeable weight)',
           public.rate_sell(coalesce(l.rate_n, l.rate_45), 'AIR', p_account, null, l.markup_pct, c.default_markup_pct),
           public.rate_sell(l.min_charge, 'AIR', p_account, null, l.markup_pct, c.default_markup_pct),
           jsonb_strip_nulls(jsonb_build_object(
             'n', public.rate_sell(l.rate_n, 'AIR', p_account, null, l.markup_pct, c.default_markup_pct),
             '45', public.rate_sell(l.rate_45, 'AIR', p_account, null, l.markup_pct, c.default_markup_pct),
             '100', public.rate_sell(l.rate_100, 'AIR', p_account, null, l.markup_pct, c.default_markup_pct),
             '250', public.rate_sell(l.rate_250, 'AIR', p_account, null, l.markup_pct, c.default_markup_pct),
             '500', public.rate_sell(l.rate_500, 'AIR', p_account, null, l.markup_pct, c.default_markup_pct),
             '1000', public.rate_sell(l.rate_1000, 'AIR', p_account, null, l.markup_pct, c.default_markup_pct))),
           l.transit_days, l.via, l.frequency, c.valid_to,
           l.origin_port_code, l.dest_port_code, c.id, null
      from public.rate_card_air_lines l join live c on c.id = l.rate_card_id, q
     where c.rate_type = 'air'
       and ((p_ref is null and q.md = 'air' and l.dest_port_code = q.pod
             and (l.origin_port_code = q.pol or l.origin_group_code in (select group_code from public.port_group_members where port_code = q.pol)))
            or p_ref = 'AIR:' || l.id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'ref', o.ref, 'product', o.product, 'carrier', o.carrier, 'container_type', o.container_type,
      'currency', o.currency, 'unit', o.unit, 'sell', o.sell, 'sell_min', o.sell_min,
      'breaks', case when o.breaks = '{}'::jsonb then null else o.breaks end,
      'transit_days', o.transit_days, 'via', o.via, 'frequency', o.frequency, 'valid_to', o.valid_to,
      'origin', o.origin_port_code, 'destination', o.dest_port_code,
      -- Extra charges the team has priced for customers (sell_amount only; buy never leaves).
      'extras', (select coalesce(jsonb_agg(jsonb_build_object('label', s.label, 'amount', s.sell_amount,
                   'currency', coalesce(s.currency_code, o.currency), 'basis', s.basis, 'scope', s.scope)), '[]'::jsonb)
                   from public.rate_surcharges s
                  where s.rate_card_id = o.card_id and s.sell_amount is not null
                    and (s.valid_to is null or s.valid_to >= current_date)
                    and (s.container_type is null or s.container_type = o.surcharge_ctr))
    ) order by o.sell is null, o.sell, o.transit_days nulls last), '[]'::jsonb)
  from opts o
$$;
revoke all on function public.portal_rate_options(text, text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.portal_search_rates(p_pol text, p_pod text, p_mode text, p_load text default null, p_container text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  acct text := public.my_account_id();
  res jsonb;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  res := public.portal_rate_options(acct, p_pol, p_pod, p_mode, p_load, p_container, null);
  insert into public.portal_rate_searches (account_id, user_id, mode, load_type, container_type, origin, destination, results, priced)
  values (acct, auth.uid(), lower(p_mode), upper(nullif(p_load, '')), upper(nullif(p_container, '')), upper(p_pol), upper(p_pod),
          jsonb_array_length(res), (select count(*) from jsonb_array_elements(res) e where e->>'sell' is not null));
  return res;
end $$;
revoke all on function public.portal_search_rates(text, text, text, text, text) from public, anon;
grant execute on function public.portal_search_rates(text, text, text, text, text) to authenticated;

create or replace function public.portal_rate_option(p_ref text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  acct text := public.my_account_id();
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if p_ref !~ '^(FCL|LCL|AIR):[0-9a-f-]{36}$' then return null; end if;
  return public.portal_rate_options(acct, null, null, null, null, null, p_ref)->0;
end $$;
revoke all on function public.portal_rate_option(text) from public, anon;
grant execute on function public.portal_rate_option(text) to authenticated;

-- Booking from a rate: the server re-prices the ref, so a tampered request can't change the price.
alter table public.bookings add column if not exists quoted_rate jsonb;

create or replace function public.portal_request_booking(p jsonb)
returns table(booking_id uuid, booking_ref text)
language plpgsql security definer set search_path = public as $$
declare
  acct text := public.my_account_id();
  dir text := lower(coalesce(p->>'direction', ''));
  md text := lower(coalesce(p->>'mode', ''));
  lt text := upper(nullif(p->>'load_type', ''));
  v_module text;
  v_mode text;
  v_id uuid;
  v_ref text;
  v_rate jsonb;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if dir not in ('import', 'export') then raise exception 'Choose import or export'; end if;
  if md not in ('sea', 'air') then raise exception 'Choose sea or air'; end if;
  if coalesce(trim(p->>'origin'), '') = '' or coalesce(trim(p->>'destination'), '') = '' then
    raise exception 'Origin and destination are required';
  end if;
  if md = 'sea' and lt not in ('FCL', 'LCL') then raise exception 'Choose FCL or LCL'; end if;

  if nullif(p->>'rate_ref', '') is not null then
    v_rate := public.portal_rate_options(acct, null, null, null, null, null, p->>'rate_ref')->0;
    if v_rate is null then raise exception 'That rate has expired. Search again or send the booking without it.'; end if;
    v_rate := v_rate || jsonb_build_object('booked_at', now());
  end if;

  v_module := case when md = 'sea' and dir = 'import' then 'IS' when md = 'sea' then 'ES' when dir = 'import' then 'IA' else 'EA' end;
  v_mode := md || '_' || dir;

  insert into public.bookings (
    module, mode, load_type, source, status, account_id, consignee_account_id, importer_account_id,
    origin, destination, incoterm, cargo_ready_date, etd,
    goods_description, commodity, pieces, packing_type, gross_weight_kg, cbm,
    container_type, container_count, is_dg, un_number, dg_class, is_temp_controlled, temp_range,
    shipper_address, consignee_name, consignee_address, special_instructions, customer_ref, requested_by, quoted_rate
  ) values (
    v_module, v_mode, case when md = 'sea' then lt end, 'customer_portal', 'submitted', acct,
    case when dir = 'import' then acct end, case when dir = 'import' then acct end,
    upper(trim(p->>'origin')), upper(trim(p->>'destination')), nullif(p->>'incoterm', ''),
    nullif(p->>'cargo_ready_date', '')::date, nullif(p->>'etd', '')::date,
    nullif(trim(p->>'goods_description'), ''), nullif(trim(p->>'goods_description'), ''),
    nullif(p->>'pieces', '')::numeric, nullif(p->>'packing_type', ''),
    nullif(p->>'weight_kg', '')::numeric, nullif(p->>'cbm', '')::numeric,
    case when lt = 'FCL' then nullif(p->>'container_type', '') end,
    case when lt = 'FCL' then nullif(p->>'container_count', '')::int end,
    coalesce((p->>'is_dg')::boolean, false), nullif(p->>'un_number', ''), nullif(p->>'dg_class', ''),
    coalesce((p->>'is_temp_controlled')::boolean, false), nullif(p->>'temp_range', ''),
    nullif(trim(p->>'shipper'), ''), nullif(trim(p->>'consignee'), ''), nullif(trim(p->>'consignee_address'), ''),
    nullif(trim(p->>'notes'), ''), nullif(trim(p->>'customer_ref'), ''), auth.uid(), v_rate
  )
  returning id, bookings.booking_ref into v_id, v_ref;

  return query select v_id, v_ref;
end $$;
revoke all on function public.portal_request_booking(jsonb) from public, anon;
grant execute on function public.portal_request_booking(jsonb) to authenticated;

-- No published rate: ask for a quote. Lands in the staff quotes module as an open quote.
create or replace function public.portal_request_quote(p jsonb)
returns table(quote_id uuid, quote_no text)
language plpgsql security definer set search_path = public as $$
declare
  acct text := public.my_account_id();
  md text := lower(coalesce(p->>'mode', ''));
  lt text := upper(nullif(p->>'load_type', ''));
  v_id uuid;
  v_no text;
  v_name text;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if md not in ('sea', 'air') then raise exception 'Choose sea or air'; end if;
  if coalesce(trim(p->>'origin'), '') = '' or coalesce(trim(p->>'destination'), '') = '' then
    raise exception 'Origin and destination are required';
  end if;
  select name into v_name from public.customers where account_id = acct;

  insert into public.quotes (
    status, source, source_meta, shipment_mode, shipment_type, customer_account_id, customer_name,
    from_port_code, to_port_code, pickup_date, is_hazardous, need_refrigeration, external_notes, customer_po, created_by
  ) values (
    'open', 'customer_portal',
    jsonb_build_object('requested_by', auth.uid(), 'container_type', nullif(p->>'container_type', ''),
                       'container_count', nullif(p->>'container_count', ''), 'direction', nullif(p->>'direction', '')),
    md, case when md = 'air' then 'Air' else coalesce(lt, 'FCL') end, acct, v_name,
    upper(trim(p->>'origin')), upper(trim(p->>'destination')), nullif(p->>'cargo_ready_date', '')::date,
    coalesce((p->>'is_dg')::boolean, false), coalesce((p->>'is_temp_controlled')::boolean, false),
    nullif(trim(p->>'notes'), ''), nullif(trim(p->>'customer_ref'), ''), null
  ) returning id, quotes.quote_no into v_id, v_no;

  if coalesce(trim(p->>'goods_description'), '') <> '' or nullif(p->>'weight_kg', '') is not null or nullif(p->>'cbm', '') is not null then
    insert into public.quote_cargo_lines (quote_id, ord, cargo_description, packages, gross_wt, volume_cbm)
    values (v_id, 1, nullif(trim(p->>'goods_description'), ''), nullif(p->>'pieces', '')::numeric,
            nullif(p->>'weight_kg', '')::numeric, nullif(p->>'cbm', '')::numeric);
  end if;

  perform public.portal_booking_notify_queue(v_id, 'quote_request');
  return query select v_id, v_no;
end $$;
revoke all on function public.portal_request_quote(jsonb) from public, anon;
grant execute on function public.portal_request_quote(jsonb) to authenticated;

-- Customers see their own quote requests.
create or replace view public.portal_quotes as
  select q.id, q.quote_no, q.status, q.shipment_mode, q.shipment_type, q.from_port_code, q.to_port_code,
         q.pickup_date, q.customer_po, q.created_at, q.updated_at, q.source
    from public.quotes q
   where q.customer_account_id = public.my_account_id();
grant select on public.portal_quotes to authenticated;

-- Customers see the rate they booked against.
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
    decline_reason,
    quoted_rate
   from public.bookings b
  where archived_at is null
    and (status <> 'draft' or source = 'customer_portal')
    and (public.my_account_id() = account_id or public.my_account_id() = consignee_account_id or public.my_account_id() = importer_account_id);

-- Staff alert data for a portal quote request (service role only). Uses the portal-booking-notify function.
create or replace function public.portal_quote_notify_payload(p_quote uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'kind', 'quote', 'id', q.id, 'quote_no', q.quote_no, 'mode', q.shipment_mode, 'type', q.shipment_type,
    'origin', q.from_port_code, 'destination', q.to_port_code, 'ready', q.pickup_date,
    'is_dg', q.is_hazardous, 'is_temp', q.need_refrigeration, 'notes', q.external_notes, 'customer_ref', q.customer_po,
    'account_id', q.customer_account_id, 'customer_name', q.customer_name,
    'direction', q.source_meta->>'direction', 'container_type', q.source_meta->>'container_type',
    'container_count', q.source_meta->>'container_count',
    'requester_email', (select u.email from auth.users u where u.id = (q.source_meta->>'requested_by')::uuid),
    'goods', (select l.cargo_description from public.quote_cargo_lines l where l.quote_id = q.id order by l.ord limit 1),
    'weight_kg', (select l.gross_wt from public.quote_cargo_lines l where l.quote_id = q.id order by l.ord limit 1),
    'cbm', (select l.volume_cbm from public.quote_cargo_lines l where l.quote_id = q.id order by l.ord limit 1),
    'sent', '[]'::jsonb
  )
  from public.quotes q where q.id = p_quote
$$;
revoke all on function public.portal_quote_notify_payload(uuid) from public, anon, authenticated;
grant execute on function public.portal_quote_notify_payload(uuid) to service_role;

-- Booking alert shows the rate the customer booked against.
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
    'customer_ref', b.customer_ref, 'decline_reason', b.decline_reason, 'quoted_rate', b.quoted_rate,
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

notify pgrst, 'reload schema';

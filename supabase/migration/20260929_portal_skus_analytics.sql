-- Customer SKUs, purchase orders and deeper analytics for the portal.
--   * portal_products / portal_purchase_orders / portal_po_lines / portal_po_allocations
--     Customer-owned (RLS: own account only; staff read). Filled by Excel/CSV upload in the portal.
--   * POs link to ERP shipments through the shipment's customer ref (PO number), or explicit allocations.
--   * portal_import_products() / portal_import_po_lines(): bulk upsert from an uploaded sheet
--   * portal_supply_chain(): PO lines with shipped / in transit / arrived / open quantities per shipment
--   * portal_analytics_v2(months): spend, cost per kg, lanes, suppliers, on-time, delay, CO2e estimates
-- Idempotent.

-- ---------- tables ----------
create table if not exists public.portal_products (
  id uuid primary key default gen_random_uuid(),
  account_id text not null default public.my_account_id() references public.customers(account_id) on delete cascade,
  sku text not null,
  description text,
  category text,
  supplier text,
  hs_code text,
  unit_value numeric,
  currency text,
  unit_weight_kg numeric,
  unit_cbm numeric,
  units_per_carton numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, sku)
);

create table if not exists public.portal_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  account_id text not null default public.my_account_id() references public.customers(account_id) on delete cascade,
  po_number text not null,
  supplier text,
  order_date date,
  required_date date,
  currency text,
  notes text,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, po_number)
);

create table if not exists public.portal_po_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.portal_purchase_orders(id) on delete cascade,
  account_id text not null default public.my_account_id(),
  sku text not null,
  description text,
  qty_ordered numeric not null check (qty_ordered >= 0),
  unit_price numeric,
  created_at timestamptz not null default now(),
  unique (po_id, sku)
);
create index if not exists portal_po_lines_account on public.portal_po_lines (account_id, sku);

create table if not exists public.portal_po_allocations (
  id uuid primary key default gen_random_uuid(),
  po_line_id uuid not null references public.portal_po_lines(id) on delete cascade,
  account_id text not null default public.my_account_id(),
  job_unique bigint not null,
  qty numeric not null check (qty > 0),
  created_at timestamptz not null default now(),
  unique (po_line_id, job_unique)
);

do $$
declare t text;
begin
  foreach t in array array['portal_products', 'portal_purchase_orders', 'portal_po_lines', 'portal_po_allocations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated using (account_id = public.my_account_id()) with check (account_id = public.my_account_id())', t);
    execute format('drop policy if exists staff_read on public.%I', t);
    execute format('create policy staff_read on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Allocations only to the customer's own shipments.
drop policy if exists own_rows on public.portal_po_allocations;
create policy own_rows on public.portal_po_allocations for all to authenticated
  using (account_id = public.my_account_id())
  with check (account_id = public.my_account_id() and exists (select 1 from public.portal_shipments ps where ps.job_unique = portal_po_allocations.job_unique));

create or replace function public.portal_touch_updated()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_portal_products_touch on public.portal_products;
create trigger trg_portal_products_touch before update on public.portal_products for each row execute function public.portal_touch_updated();
drop trigger if exists trg_portal_pos_touch on public.portal_purchase_orders;
create trigger trg_portal_pos_touch before update on public.portal_purchase_orders for each row execute function public.portal_touch_updated();

-- ---------- imports ----------
-- rows: [{sku, description, category, supplier, hs_code, unit_value, currency, unit_weight_kg, unit_cbm, units_per_carton}]
create or replace function public.portal_import_products(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  acct text := public.my_account_id();
  n_new int := 0; n_upd int := 0; r jsonb; v_sku text; existed boolean;
  num_ text;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Up to 5,000 products per upload'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_sku := upper(trim(coalesce(r->>'sku', '')));
    continue when v_sku = '';
    existed := exists (select 1 from public.portal_products where account_id = acct and sku = v_sku);
    insert into public.portal_products (account_id, sku, description, category, supplier, hs_code, unit_value, currency, unit_weight_kg, unit_cbm, units_per_carton)
    values (acct, v_sku, nullif(trim(r->>'description'), ''), nullif(trim(r->>'category'), ''), nullif(trim(r->>'supplier'), ''),
            nullif(trim(r->>'hs_code'), ''), public.portal_num(r->>'unit_value'), upper(nullif(trim(r->>'currency'), '')),
            public.portal_num(r->>'unit_weight_kg'), public.portal_num(r->>'unit_cbm'), public.portal_num(r->>'units_per_carton'))
    on conflict (account_id, sku) do update set
      description = coalesce(excluded.description, portal_products.description),
      category = coalesce(excluded.category, portal_products.category),
      supplier = coalesce(excluded.supplier, portal_products.supplier),
      hs_code = coalesce(excluded.hs_code, portal_products.hs_code),
      unit_value = coalesce(excluded.unit_value, portal_products.unit_value),
      currency = coalesce(excluded.currency, portal_products.currency),
      unit_weight_kg = coalesce(excluded.unit_weight_kg, portal_products.unit_weight_kg),
      unit_cbm = coalesce(excluded.unit_cbm, portal_products.unit_cbm),
      units_per_carton = coalesce(excluded.units_per_carton, portal_products.units_per_carton);
    if existed then n_upd := n_upd + 1; else n_new := n_new + 1; end if;
  end loop;
  return jsonb_build_object('added', n_new, 'updated', n_upd);
end $$;

-- Lenient number parse for spreadsheet cells ("1,250.00", " 12 ").
create or replace function public.portal_num(p text)
returns numeric language sql immutable as $$
  select case when regexp_replace(coalesce(p, ''), '[^0-9.\-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
              then regexp_replace(p, '[^0-9.\-]', '', 'g')::numeric end
$$;

-- rows: [{po_number, supplier, order_date, required_date, currency, sku, description, qty, unit_price}]
create or replace function public.portal_import_po_lines(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  acct text := public.my_account_id();
  r jsonb; v_po uuid; v_no text; v_sku text; v_qty numeric;
  n_lines int := 0; pos text[] := '{}'; n_prod int := 0;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows'; end if;
  if jsonb_array_length(p_rows) > 10000 then raise exception 'Up to 10,000 PO lines per upload'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_no := upper(trim(coalesce(r->>'po_number', '')));
    v_sku := upper(trim(coalesce(r->>'sku', '')));
    v_qty := public.portal_num(r->>'qty');
    continue when v_no = '' or v_sku = '' or v_qty is null;

    insert into public.portal_purchase_orders (account_id, po_number, supplier, order_date, required_date, currency)
    values (acct, v_no, nullif(trim(r->>'supplier'), ''), public.portal_date(r->>'order_date'), public.portal_date(r->>'required_date'),
            upper(nullif(trim(r->>'currency'), '')))
    on conflict (account_id, po_number) do update set
      supplier = coalesce(excluded.supplier, portal_purchase_orders.supplier),
      order_date = coalesce(excluded.order_date, portal_purchase_orders.order_date),
      required_date = coalesce(excluded.required_date, portal_purchase_orders.required_date),
      currency = coalesce(excluded.currency, portal_purchase_orders.currency)
    returning id into v_po;

    insert into public.portal_po_lines (po_id, account_id, sku, description, qty_ordered, unit_price)
    values (v_po, acct, v_sku, nullif(trim(r->>'description'), ''), v_qty, public.portal_num(r->>'unit_price'))
    on conflict (po_id, sku) do update set
      qty_ordered = excluded.qty_ordered,
      unit_price = coalesce(excluded.unit_price, portal_po_lines.unit_price),
      description = coalesce(excluded.description, portal_po_lines.description);
    n_lines := n_lines + 1;
    if not v_no = any (pos) then pos := pos || v_no; end if;

    -- Unknown SKU: create a product so it shows up in the catalogue.
    insert into public.portal_products (account_id, sku, description, supplier, unit_value, currency)
    values (acct, v_sku, nullif(trim(r->>'description'), ''), nullif(trim(r->>'supplier'), ''),
            public.portal_num(r->>'unit_price'), upper(nullif(trim(r->>'currency'), '')))
    on conflict (account_id, sku) do nothing;
    if found then n_prod := n_prod + 1; end if;
  end loop;
  return jsonb_build_object('pos', coalesce(array_length(pos, 1), 0), 'lines', n_lines, 'new_products', n_prod);
end $$;

-- Dates from spreadsheets: ISO, d/m/y (NZ), or Excel serial numbers.
create or replace function public.portal_date(p text)
returns date language plpgsql immutable as $$
declare s text := trim(coalesce(p, ''));
begin
  if s = '' then return null; end if;
  if s ~ '^\d{4}-\d{1,2}-\d{1,2}' then return left(s, 10)::date; end if;
  if s ~ '^\d{1,2}/\d{1,2}/\d{2,4}$' then return to_date(s, case when length(split_part(s, '/', 3)) = 2 then 'DD/MM/YY' else 'DD/MM/YYYY' end); end if;
  if s ~ '^\d{5}(\.\d+)?$' then return date '1899-12-30' + floor(s::numeric)::int; end if;
  return null;
exception when others then return null;
end $$;

revoke all on function public.portal_import_products(jsonb) from public, anon;
grant execute on function public.portal_import_products(jsonb) to authenticated;
revoke all on function public.portal_import_po_lines(jsonb) from public, anon;
grant execute on function public.portal_import_po_lines(jsonb) to authenticated;

-- ---------- supply chain read model ----------
-- Every PO line with where its quantity sits. Explicit allocations win; otherwise a PO whose number appears
-- in exactly one shipment's customer ref is taken as fully on that shipment.
create or replace function public.portal_supply_chain()
returns jsonb
language sql stable security definer set search_path = public as $$
  with acct as (select public.my_account_id() a),
  ships as (
    select ps.job_unique, ps.stage, ps.etd, ps.eta, ps.departed, ps.arrived, ps.origin, ps.destination, ps.mode, ps.shipper_name,
           ps.customer_ref, ps.vessel_flight,
           case when ps.module like 'FI%' then ps.module || '-' || ps.shipment_no
                  || case when coalesce(ps.job_no, 1) > 1 then '/' || ps.job_no else '' end
                else coalesce(ps.job_no::text, ps.consol_key) end as shipment_no,
           (select coalesce(sum(i.amt_local), 0) from public.portal_invoices i where i.job_unique = ps.job_unique) as freight_cost
      from public.portal_shipments ps
     where ps.customer_ref is not null or exists (select 1 from public.portal_po_allocations a where a.job_unique = ps.job_unique)
  ),
  po_ship as (
    select po.id po_id, s.job_unique
      from public.portal_purchase_orders po, acct, ships s
     where po.account_id = acct.a
       and upper(po.po_number) = any (regexp_split_to_array(upper(coalesce(s.customer_ref, '')), '[\s,;/&+]+'))
  ),
  implicit as (
    select po_id, min(job_unique) job_unique from po_ship group by po_id having count(*) = 1
  ),
  alloc as (
    select a.po_line_id, a.job_unique, a.qty, false as implicit from public.portal_po_allocations a, acct where a.account_id = acct.a
    union all
    select l.id, i.job_unique, l.qty_ordered, true
      from public.portal_po_lines l join implicit i on i.po_id = l.po_id
     where not exists (select 1 from public.portal_po_allocations a where a.po_line_id = l.id)
  )
  select jsonb_build_object(
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'line_id', l.id, 'po_id', po.id, 'po_number', po.po_number, 'supplier', po.supplier, 'order_date', po.order_date,
        'required_date', po.required_date, 'po_status', po.status, 'currency', po.currency,
        'sku', l.sku, 'description', coalesce(l.description, p.description), 'qty_ordered', l.qty_ordered, 'unit_price', l.unit_price,
        'allocations', coalesce((select jsonb_agg(jsonb_build_object('job_unique', al.job_unique, 'qty', al.qty, 'implicit', al.implicit))
                                   from alloc al where al.po_line_id = l.id), '[]'::jsonb)
      ) order by po.order_date desc nulls last, po.po_number, l.sku)
      from public.portal_po_lines l
      join public.portal_purchase_orders po on po.id = l.po_id
      left join public.portal_products p on p.account_id = l.account_id and p.sku = l.sku, acct
     where l.account_id = acct.a), '[]'::jsonb),
    'po_shipments', coalesce((select jsonb_agg(jsonb_build_object('po_id', po_id, 'job_unique', job_unique)) from po_ship), '[]'::jsonb),
    'shipments', coalesce((
      select jsonb_agg(to_jsonb(s))
        from ships s
       where s.job_unique in (select job_unique from po_ship union select job_unique from alloc)), '[]'::jsonb)
  )
$$;
revoke all on function public.portal_supply_chain() from public, anon;
grant execute on function public.portal_supply_chain() to authenticated;

-- ---------- analytics ----------
-- Great-circle km between two port codes (sea UN/LOCODE or IATA).
create or replace function public.port_distance_km(p_a text, p_b text)
returns numeric language sql stable set search_path = public as $$
  select round((6371 * 2 * asin(sqrt(
           power(sin(radians((b.lat - a.lat) / 2)), 2) +
           cos(radians(a.lat)) * cos(radians(b.lat)) * power(sin(radians((b.lng - a.lng) / 2)), 2))))::numeric)
    from public.ports a, public.ports b
   where a.code = upper(p_a) and b.code = upper(p_b) and a.lat is not null and b.lat is not null
   limit 1
$$;

create or replace function public.portal_analytics_v2(p_months int default 12)
returns jsonb
language sql stable security definer set search_path = public as $$
  with prm as (
    select greatest(1, least(coalesce(p_months, 12), 36)) n,
           (date_trunc('month', current_date) - make_interval(months => greatest(1, least(coalesce(p_months, 12), 36)) - 1))::date start_m
  ),
  prev as (select (start_m - make_interval(months => n))::date prev_start, start_m prev_end from prm),
  -- ERP rarely stamps actual dates, so fall back to SeaVantage actuals on the consol and PortConnect ATA on linked bookings.
  raw as (
    select ps.*,
           coalesce(ps.departed, (select min(e.event_datetime)::date from public.consol_tracking_events e
                                   where e.consol_key = ps.consol_key and e.event_type_code in ('VD', 'DEPA') and not e.is_estimated)) act_dep,
           coalesce(ps.arrived,
                    (select min(e.event_datetime)::date from public.consol_tracking_events e
                      where e.consol_key = ps.consol_key and e.event_type_code in ('VA', 'ARRI') and not e.is_estimated
                        and upper(coalesce(e.partner_port_code, '')) = upper(coalesce(ps.destination, ''))),
                    (select min(ct.inbound_ata)::date from public.container_tracking ct join public.bookings bk on bk.id = ct.booking_id
                      where bk.shipment_id = ps.job_unique)) act_arr
      from public.portal_shipments ps
     where public.my_account_id() is not null
       and ps.doc_date >= (select prev_start from prev)
  ),
  base as (
    select r.*, lower(r.mode) md,
           (select coalesce(sum(i.amt_local), 0) from public.portal_invoices i where i.job_unique = r.job_unique) spend,
           public.port_distance_km(r.origin, r.destination) km,
           case when r.act_arr is not null and r.act_dep is not null then r.act_arr - r.act_dep end transit,
           case when r.act_arr is not null and r.eta is not null then r.act_arr - r.eta end delay,
           case when r.direction = 'export' then r.consignee_name else r.shipper_name end party
      from raw r
  ),
  -- CO2e estimate, GLEC-style defaults: sea 16 g/t-km over 1.15x routed distance; air 602 g/t-km plus 95 km.
  s as (
    select b.*, case when b.km is null or coalesce(b.weight_kg, 0) = 0 then null
                     when b.md = 'air' then round((b.weight_kg / 1000.0) * (b.km + 95) * 0.602)
                     else round((b.weight_kg / 1000.0) * (b.km * 1.15) * 0.016) end co2_kg
      from base b where b.doc_date >= (select start_m from prm)
  ),
  p as (select * from base where doc_date < (select start_m from prm)),
  months as (select generate_series((select start_m from prm), date_trunc('month', current_date)::date, interval '1 month')::date m),
  tot as (
    select count(*) shipments, coalesce(sum(spend), 0) spend, coalesce(sum(weight_kg), 0) kg, coalesce(sum(volume_m3), 0) cbm,
           coalesce(sum(co2_kg), 0) co2_kg,
           count(*) filter (where md = 'sea') sea, count(*) filter (where md = 'air') air,
           coalesce(sum(spend) filter (where md = 'sea'), 0) sea_spend, coalesce(sum(spend) filter (where md = 'air'), 0) air_spend,
           round(avg(transit)::numeric, 1) transit, count(delay) arrived_n, count(*) filter (where delay <= 1) on_time,
           round(avg(delay) filter (where delay > 1)::numeric, 1) avg_late_days
      from s
  ),
  ptot as (
    select count(*) shipments, coalesce(sum(spend), 0) spend, coalesce(sum(weight_kg), 0) kg,
           count(delay) arrived_n, count(*) filter (where delay <= 1) on_time, round(avg(transit)::numeric, 1) transit
      from p
  )
  select jsonb_build_object(
    'months_n', (select n from prm),
    'totals', (select to_jsonb(tot) from tot),
    'prior', (select to_jsonb(ptot) from ptot),
    'months', (select jsonb_agg(jsonb_build_object(
                  'month', to_char(m.m, 'YYYY-MM'),
                  'sea', (select count(*) from s where md = 'sea' and date_trunc('month', doc_date)::date = m.m),
                  'air', (select count(*) from s where md = 'air' and date_trunc('month', doc_date)::date = m.m),
                  'kg', (select coalesce(round(sum(weight_kg)), 0) from s where date_trunc('month', doc_date)::date = m.m),
                  'cbm', (select coalesce(round(sum(volume_m3)::numeric, 1), 0) from s where date_trunc('month', doc_date)::date = m.m),
                  'spend', (select coalesce(round(sum(i.amt_local)::numeric, 2), 0) from public.portal_invoices i where date_trunc('month', i.doc_date)::date = m.m),
                  'co2_kg', (select coalesce(sum(co2_kg), 0) from s where date_trunc('month', doc_date)::date = m.m),
                  'on_time', (select count(*) filter (where delay <= 1) from s where delay is not null and date_trunc('month', act_arr)::date = m.m),
                  'arrived', (select count(*) from s where delay is not null and date_trunc('month', act_arr)::date = m.m)
                ) order by m.m) from months m),
    'lanes', coalesce((select jsonb_agg(l order by (l->>'n')::int desc) from (
        select jsonb_build_object('origin', origin, 'destination', destination, 'mode', md, 'n', count(*),
               'kg', coalesce(round(sum(weight_kg)), 0), 'spend', round(sum(spend)::numeric, 2),
               'cost_per_kg', case when sum(weight_kg) > 0 then round((sum(spend) / sum(weight_kg))::numeric, 2) end,
               'transit_days', round(avg(transit)::numeric, 1),
               'sched_days', round(avg(case when eta >= etd then eta - etd end)::numeric, 1),
               'on_time_pct', case when count(delay) >= 2 then round(100.0 * count(*) filter (where delay <= 1) / count(delay)) end,
               'co2_kg', coalesce(sum(co2_kg), 0)) l
          from s where origin is not null and destination is not null
         group by origin, destination, md order by count(*) desc limit 15) x), '[]'::jsonb),
    'parties', coalesce((select jsonb_agg(l order by (l->>'n')::int desc) from (
        select jsonb_build_object('party', party, 'n', count(*), 'kg', coalesce(round(sum(weight_kg)), 0),
               'spend', round(sum(spend)::numeric, 2), 'transit_days', round(avg(transit)::numeric, 1),
               'on_time_pct', case when count(delay) >= 2 then round(100.0 * count(*) filter (where delay <= 1) / count(delay)) end,
               'avg_delay', round(avg(delay)::numeric, 1), 'last', max(doc_date),
               'origins', to_jsonb(array_agg(distinct origin))) l
          from s where party is not null
         group by party order by count(*) desc limit 12) x), '[]'::jsonb),
    'delays', coalesce((select jsonb_agg(jsonb_build_object('job_unique', job_unique, 'origin', origin, 'destination', destination,
               'eta', eta, 'arrived', act_arr, 'delay', delay, 'party', party, 'vessel', vessel_flight) order by delay desc)
          from (select * from s where delay > 2 order by delay desc limit 8) d), '[]'::jsonb),
    'containers', (select jsonb_build_object('n', count(*), 'teu', coalesce(sum(case when c.container_size ilike '4%' then 2 else 1 end), 0))
          from public.portal_containers c where exists (select 1 from s where s.consol_key = c.consol_key and s.md = 'sea'))
  )
$$;
revoke all on function public.portal_analytics_v2(int) from public, anon;
grant execute on function public.portal_analytics_v2(int) to authenticated;

notify pgrst, 'reload schema';

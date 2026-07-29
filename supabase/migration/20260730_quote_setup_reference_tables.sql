-- Setup-driven reference tables for the Quotation Response editor.
-- The future Setup screen becomes CRUD over these same tables; dropdowns
-- read from here so nothing is hard-coded. Staff-only RLS throughout.

create table if not exists public.currencies (
  code text primary key,
  name text not null,
  symbol text,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.charge_units (
  code text primary key,
  label text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_rates (
  code text primary key,
  label text not null,
  rate_pct numeric not null default 0,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_lines (
  code text primary key,
  name text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.currencies     enable row level security;
alter table public.charge_units   enable row level security;
alter table public.tax_rates      enable row level security;
alter table public.shipping_lines enable row level security;

drop policy if exists currencies_staff_all on public.currencies;
create policy currencies_staff_all on public.currencies for all using (is_staff()) with check (is_staff());
drop policy if exists charge_units_staff_all on public.charge_units;
create policy charge_units_staff_all on public.charge_units for all using (is_staff()) with check (is_staff());
drop policy if exists tax_rates_staff_all on public.tax_rates;
create policy tax_rates_staff_all on public.tax_rates for all using (is_staff()) with check (is_staff());
drop policy if exists shipping_lines_staff_all on public.shipping_lines;
create policy shipping_lines_staff_all on public.shipping_lines for all using (is_staff()) with check (is_staff());

insert into public.currencies (code, name, symbol, sort_order) values
  ('NZD','New Zealand Dollar','$',10),('USD','US Dollar','$',20),('AUD','Australian Dollar','$',30),
  ('EUR','Euro','€',40),('GBP','Pound Sterling','£',50),('SGD','Singapore Dollar','$',60),
  ('CNY','Chinese Yuan','¥',70),('HKD','Hong Kong Dollar','$',80),('JPY','Japanese Yen','¥',90),
  ('FJD','Fijian Dollar','$',100)
on conflict (code) do nothing;

insert into public.charge_units (code, label, sort_order) values
  ('per_20','Per 20''',10),('per_40','Per 40''',20),('per_40hc','Per 40'' HC',30),('per_45hc','Per 45'' HC',40),
  ('per_container','Per Container',50),('per_bl','Per BL',60),('per_shipment','Per Shipment',70),
  ('per_clearance','Per Clearance',80),('per_cbm','Per CBM',90),('per_kg','Per KG',100),
  ('per_wm','Per W/M',110),('flat','Flat',120)
on conflict (code) do nothing;

insert into public.tax_rates (code, label, rate_pct, sort_order) values
  ('no_tax','No Tax',0,10),('gst_15','GST 15%',15,20),('zero','Zero Rated',0,30),('exempt','Exempt',0,40)
on conflict (code) do nothing;

insert into public.shipping_lines (code, name, sort_order) values
  ('ANL','ANL Container Line',10),('MAERSK','Maersk',20),('MSC','MSC',30),('CMACGM','CMA CGM',40),
  ('HAPAG','Hapag-Lloyd',50),('ONE','Ocean Network Express (ONE)',60),('COSCO','COSCO Shipping',70),
  ('OOCL','OOCL',80),('PIL','Pacific International Lines (PIL)',90),('NEPTUNE','Neptune Pacific Direct Line',100),
  ('MATSON','Matson',110),('SOFRANA','Sofrana Unilines',120)
on conflict (code) do nothing;

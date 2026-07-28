-- Quotes module (portal = system of record).
-- Four tables: quotes (request) → quote_cargo_lines,
--              quote_responses (priced offers) → quote_response_lines (rate grid).
-- Staff-only RLS throughout.

-- ── number generators ───────────────────────────────────────────────────────
create sequence if not exists public.quote_no_seq;
create sequence if not exists public.quote_response_no_seq;

create or replace function public.gen_quote_no()
returns trigger language plpgsql as $$
begin
  if new.quote_no is null or new.quote_no = '' then
    new.quote_no := 'UBF-Q-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.quote_no_seq')::text, 4, '0');
  end if;
  return new;
end; $$;

create or replace function public.gen_quote_response_no()
returns trigger language plpgsql as $$
begin
  if new.response_no is null or new.response_no = '' then
    new.response_no := 'QOR' || lpad(nextval('public.quote_response_no_seq')::text, 6, '0');
  end if;
  return new;
end; $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

-- ── quotes (Request Section) ────────────────────────────────────────────────
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text unique,
  status text not null default 'open'
    check (status in ('open', 'published', 'sent', 'won', 'lost')),

  -- basic
  shipment_mode text,                 -- Air Cargo, LCL, FCL, ...
  shipment_type text,
  incoterms text,
  incoterm_place text,
  customer_account_id text references public.customers(account_id),  -- FDB-synced
  customer_name text,
  customer_po text,
  shipper text,
  consignee text,
  movement_type text,                 -- import / export
  sales_executive_id uuid references public.staff_users(user_id),
  pricing_executive_id uuid references public.staff_users(user_id),
  request_received_from text,
  product_type text,
  project text,

  -- origin
  origin_location_type text,
  pickup_date date,
  pickup_location text,
  pickup_postal_code text,
  pickup_address text,

  -- destination
  dest_location_type text,
  delivery_date date,
  drop_location text,
  drop_postal_code text,
  drop_address text,

  -- cargo value + flags
  cargo_value numeric,
  cargo_value_currency text default 'NZD',
  need_insurance boolean not null default false,
  need_refrigeration boolean not null default false,
  is_hazardous boolean not null default false,
  hazard_comments text,

  created_by uuid references public.staff_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quotes_customer_idx on public.quotes(customer_account_id);
create index if not exists quotes_created_idx on public.quotes(created_at desc);

-- ── quote_cargo_lines (Load Details) ────────────────────────────────────────
create table if not exists public.quote_cargo_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  ord integer not null default 0,
  cargo_description text,
  package_type text,
  packages numeric,
  volume_cbm numeric,
  volume_wt numeric,
  gross_wt numeric,
  chargeable_wt numeric,
  created_at timestamptz not null default now()
);
create index if not exists quote_cargo_lines_quote_idx on public.quote_cargo_lines(quote_id);

-- ── quote_responses (priced offers) ─────────────────────────────────────────
create table if not exists public.quote_responses (
  id uuid primary key default gen_random_uuid(),
  response_no text unique,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'sent_for_approval', 'approved')),

  quotation_date date,
  valid_from date,
  valid_till date,
  etd date,
  eta date,
  carrier text,                       -- airline / shipping line
  via_port text,
  transit_time_days integer,
  origin_free_time_days integer,
  detention_free_time_dest integer,
  product text,

  currency text not null default 'NZD',
  exchange_rate numeric not null default 1,
  include_payment_link boolean not null default false,
  enable_fixed_items boolean not null default false,
  customer_notes text,
  terms_conditions text,

  -- stored totals (computed app-side on save)
  sub_total numeric,
  total_sell numeric,
  total_tax numeric,
  total_buy numeric,
  net_profit numeric,
  margin_pct numeric,

  created_by uuid references public.staff_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_responses_quote_idx on public.quote_responses(quote_id);

-- ── quote_response_lines (rate grid) ────────────────────────────────────────
create table if not exists public.quote_response_lines (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.quote_responses(id) on delete cascade,
  ord integer not null default 0,
  description text,
  is_service_charge boolean not null default false,
  vendor text,
  unit text,                          -- per_kg, per_clearance, flat, ...
  qty numeric,
  buy_currency text default 'NZD',
  sell_currency text default 'NZD',
  min_buy numeric,
  min_sell numeric,
  buy_rate numeric,
  sell_rate numeric,
  tax text,
  ex_rate_buy numeric default 1,
  ex_rate_sell numeric default 1,
  total_buy numeric,
  total_sell numeric,
  created_at timestamptz not null default now()
);
create index if not exists quote_response_lines_response_idx on public.quote_response_lines(response_id);

-- ── triggers ────────────────────────────────────────────────────────────────
drop trigger if exists trg_gen_quote_no on public.quotes;
create trigger trg_gen_quote_no before insert on public.quotes
  for each row execute function public.gen_quote_no();

drop trigger if exists trg_quotes_touch on public.quotes;
create trigger trg_quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_gen_response_no on public.quote_responses;
create trigger trg_gen_response_no before insert on public.quote_responses
  for each row execute function public.gen_quote_response_no();

drop trigger if exists trg_responses_touch on public.quote_responses;
create trigger trg_responses_touch before update on public.quote_responses
  for each row execute function public.touch_updated_at();

-- ── RLS: staff-only ─────────────────────────────────────────────────────────
alter table public.quotes enable row level security;
alter table public.quote_cargo_lines enable row level security;
alter table public.quote_responses enable row level security;
alter table public.quote_response_lines enable row level security;

create policy quotes_staff_all on public.quotes
  for all using (is_staff()) with check (is_staff());
create policy quote_cargo_staff_all on public.quote_cargo_lines
  for all using (is_staff()) with check (is_staff());
create policy quote_responses_staff_all on public.quote_responses
  for all using (is_staff()) with check (is_staff());
create policy quote_response_lines_staff_all on public.quote_response_lines
  for all using (is_staff()) with check (is_staff());

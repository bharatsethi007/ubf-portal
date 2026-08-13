-- FCL Local / Port Charges — standalone house tariff (decoupled from carrier freight cards)
-- Sheet header: direction + movement + multi-port + multi-shipping-line + validity
-- Lines: charge code, multi container type, buy/sell (native currency), greater-of(min floor) pricing, per-line vendor
-- Applied live via Supabase MCP 2026-08-13; this file is repo parity only.

create table if not exists public.local_charge_sheets (
  id uuid primary key default gen_random_uuid(),
  title text,
  direction text not null check (direction in ('origin','dest')),
  movement text not null check (movement in ('import','export')),
  port_codes text[] not null default '{}',
  shipping_line_codes text[] not null default '{}',
  valid_from date,
  valid_to date,
  status text not null default 'draft' check (status in ('draft','validated','active','expired')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.local_charge_lines (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.local_charge_sheets(id) on delete cascade,
  ord int not null default 0,
  charge_code text,
  label text not null default '',
  charge_group text,
  container_types text[] not null default '{}',
  basis text not null default 'per_container' check (basis in ('per_container','per_bl','per_shipment','percent')),
  percent_base text not null default 'freight',
  buy_amount numeric,
  buy_currency text,
  sell_amount numeric,
  sell_currency text,
  min_buy numeric,
  min_sell numeric,
  vendor_account_id text,
  vendor_name text,
  condition text,
  created_at timestamptz not null default now()
);

create index if not exists idx_lcs_ports on public.local_charge_sheets using gin (port_codes);
create index if not exists idx_lcs_lines_gin on public.local_charge_sheets using gin (shipping_line_codes);
create index if not exists idx_lcs_dir_mov_status on public.local_charge_sheets (direction, movement, status);
create index if not exists idx_lcs_validity on public.local_charge_sheets (valid_from, valid_to);
create index if not exists idx_lcl_sheet on public.local_charge_lines (sheet_id, ord);

alter table public.local_charge_sheets enable row level security;
alter table public.local_charge_lines  enable row level security;

drop policy if exists staff_all_local_charge_sheets on public.local_charge_sheets;
create policy staff_all_local_charge_sheets on public.local_charge_sheets
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists staff_all_local_charge_lines on public.local_charge_lines;
create policy staff_all_local_charge_lines on public.local_charge_lines
  for all using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.local_charge_sheets to authenticated, service_role;
grant select, insert, update, delete on public.local_charge_lines  to authenticated, service_role;

notify pgrst, 'reload schema';

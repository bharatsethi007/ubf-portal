-- ============================================================
-- Rate Cards & Rate Search Engine — Step 1 schema
-- ============================================================

-- Canonical container equipment lookup (editable, FK target)
create table if not exists public.container_types (
  code        text primary key,
  label       text not null,
  teu         numeric not null default 1,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.container_types (code, label, teu, sort_order) values
  ('20GP','20ft General Purpose',1,10),
  ('40GP','40ft General Purpose',2,20),
  ('40HQ','40ft High Cube',2,30),
  ('20HC','20ft High Cube',1,40),
  ('20RF','20ft Reefer',1,50),
  ('40RF','40ft Reefer',2,60),
  ('20OT','20ft Open Top',1,70),
  ('40OT','40ft Open Top',2,80),
  ('20FR','20ft Flat Rack',1,90),
  ('40FR','40ft Flat Rack',2,100)
on conflict (code) do nothing;

-- Port groups (regions like PRD)
create table if not exists public.port_groups (
  code         text primary key,
  name         text not null,
  country_code text,
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.port_group_members (
  group_code text not null references public.port_groups(code) on delete cascade,
  port_code  text not null references public.ports(code) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_code, port_code)
);

-- Deterministic port alias learning table
create table if not exists public.port_aliases (
  id         uuid primary key default gen_random_uuid(),
  alias      text not null,
  port_code  text not null references public.ports(code) on delete cascade,
  source     text not null default 'human',
  created_by uuid references public.staff_users(user_id),
  created_at timestamptz not null default now()
);
create unique index if not exists port_aliases_alias_lower_uk
  on public.port_aliases (lower(alias));

-- Rate card header (upload record)
create table if not exists public.rate_cards (
  id                 uuid primary key default gen_random_uuid(),
  shipping_line_code text not null references public.shipping_lines(code),
  rate_type          text not null check (rate_type in ('fcl','lcl','air','cartage')),
  title              text,
  source_file        text,
  currency_code      text references public.currencies(code),
  valid_from         date,
  valid_to           date,
  status             text not null default 'draft'
                       check (status in ('draft','validated','active','expired')),
  uploaded_by        uuid references public.staff_users(user_id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Typed FCL line table
create table if not exists public.rate_card_fcl_lines (
  id                uuid primary key default gen_random_uuid(),
  rate_card_id      uuid not null references public.rate_cards(id) on delete cascade,
  origin_port_code  text references public.ports(code),
  origin_group_code text references public.port_groups(code),
  dest_port_code    text not null references public.ports(code),
  container_type    text not null references public.container_types(code),
  base_rate         numeric not null,
  currency_code     text references public.currencies(code),
  transit_days      integer,
  via               text,
  valid_from        date,
  valid_to          date,
  confidence        text not null default 'green'
                      check (confidence in ('green','amber','red')),
  raw_origin        text,
  created_at        timestamptz not null default now(),
  constraint fcl_line_origin_present
    check (origin_port_code is not null or origin_group_code is not null)
);
create index if not exists rate_card_fcl_lines_card_idx
  on public.rate_card_fcl_lines(rate_card_id);
create index if not exists rate_card_fcl_lines_lane_idx
  on public.rate_card_fcl_lines(dest_port_code, container_type);

-- Shared surcharge table (origin/freight/dest, per-port levies, conditionals)
create table if not exists public.rate_surcharges (
  id                uuid primary key default gen_random_uuid(),
  rate_card_id      uuid not null references public.rate_cards(id) on delete cascade,
  charge_code       text references public.charge_codes(code),
  label             text not null,
  charge_group      text references public.charge_groups(code),
  amount            numeric not null,
  currency_code     text references public.currencies(code),
  basis             text not null default 'per_container'
                      check (basis in ('per_container','per_bl','per_cbm','per_teu','percent','flat')),
  container_type    text references public.container_types(code),
  scope             text check (scope in ('origin','freight','dest')),
  origin_port_code  text references public.ports(code),
  origin_group_code text references public.port_groups(code),
  condition         text,
  valid_from        date,
  valid_to          date,
  confidence        text not null default 'green'
                      check (confidence in ('green','amber','red')),
  created_at        timestamptz not null default now()
);
create index if not exists rate_surcharges_card_idx
  on public.rate_surcharges(rate_card_id);

-- ============ RLS: staff-only across the module ============
alter table public.container_types    enable row level security;
alter table public.port_groups        enable row level security;
alter table public.port_group_members enable row level security;
alter table public.port_aliases       enable row level security;
alter table public.rate_cards         enable row level security;
alter table public.rate_card_fcl_lines enable row level security;
alter table public.rate_surcharges    enable row level security;

create policy staff_all_container_types on public.container_types
  for all using (is_staff()) with check (is_staff());
create policy staff_all_port_groups on public.port_groups
  for all using (is_staff()) with check (is_staff());
create policy staff_all_port_group_members on public.port_group_members
  for all using (is_staff()) with check (is_staff());
create policy staff_all_port_aliases on public.port_aliases
  for all using (is_staff()) with check (is_staff());
create policy staff_all_rate_cards on public.rate_cards
  for all using (is_staff()) with check (is_staff());
create policy staff_all_rate_card_fcl_lines on public.rate_card_fcl_lines
  for all using (is_staff()) with check (is_staff());
create policy staff_all_rate_surcharges on public.rate_surcharges
  for all using (is_staff()) with check (is_staff());

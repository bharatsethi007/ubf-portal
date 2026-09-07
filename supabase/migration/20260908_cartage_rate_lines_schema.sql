-- applied to DB 8 Sep 2026 via MCP. Idempotent parity file — do not re-run.

create extension if not exists pgcrypto;

-- FCL cartage lines (zone -> zone, size 20/40, flat rate)
create table if not exists rate_card_cartage_fcl_lines (
  id uuid primary key default gen_random_uuid(),
  rate_card_id uuid not null references rate_cards(id) on delete cascade,
  direction text not null check (direction in ('import','export')),
  origin_zone_id uuid not null references cartage_zones(id),
  dest_zone_id uuid not null references cartage_zones(id),
  container_size text not null check (container_size in ('20','40')),
  base_rate numeric not null,
  min_charge numeric,
  confidence text not null default 'green' check (confidence in ('green','amber','red')),
  raw_origin text,
  raw_dest text,
  created_at timestamptz not null default now(),
  unique (rate_card_id, direction, origin_zone_id, dest_zone_id, container_size)
);

-- LTL cartage lanes (zone -> zone; per_cbm for LCL W/M; min_charge)
create table if not exists rate_card_cartage_ltl_lanes (
  id uuid primary key default gen_random_uuid(),
  rate_card_id uuid not null references rate_cards(id) on delete cascade,
  direction text not null check (direction in ('import','export')),
  origin_zone_id uuid not null references cartage_zones(id),
  dest_zone_id uuid not null references cartage_zones(id),
  min_charge numeric,
  per_cbm numeric,
  confidence text not null default 'green' check (confidence in ('green','amber','red')),
  raw_origin text,
  raw_dest text,
  created_at timestamptz not null default now(),
  unique (rate_card_id, direction, origin_zone_id, dest_zone_id)
);

-- LTL per-band rates (per_kg by weight band, child of lane)
create table if not exists rate_card_cartage_ltl_band_rates (
  id uuid primary key default gen_random_uuid(),
  lane_id uuid not null references rate_card_cartage_ltl_lanes(id) on delete cascade,
  band_id uuid not null references cartage_weight_bands(id),
  per_kg numeric not null,
  unique (lane_id, band_id)
);

-- RLS staff-only
do $$
declare t text;
begin
  foreach t in array array[
    'rate_card_cartage_fcl_lines','rate_card_cartage_ltl_lanes','rate_card_cartage_ltl_band_rates'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists staff_all_%s on %I', t, t);
    execute format('create policy staff_all_%s on %I for all using (is_staff()) with check (is_staff())', t, t);
  end loop;
end $$;

-- lookup indexes
create index if not exists rc_cart_fcl_lookup on rate_card_cartage_fcl_lines (direction, origin_zone_id, dest_zone_id, container_size);
create index if not exists rc_cart_ltl_lookup on rate_card_cartage_ltl_lanes (direction, origin_zone_id, dest_zone_id);
create index if not exists rc_cart_ltl_band_lane on rate_card_cartage_ltl_band_rates (lane_id);

notify pgrst, 'reload schema';

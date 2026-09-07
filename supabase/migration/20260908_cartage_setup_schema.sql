-- 20260908_cartage_setup_schema.sql
-- Cartage config/setup (zones, bands, surcharges, FAF). Step 1 of 2. Idempotent parity file — do not re-run.

create extension if not exists pgcrypto;

-- 1. zones
create table if not exists cartage_zones (
  id uuid primary key default gen_random_uuid(),
  zone_code text not null unique,
  name text not null,
  zone_type text not null default 'area' check (zone_type in ('area','port','depot')),
  island text check (island in ('NI','SI')),
  region text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. zone members (address -> zone)
create table if not exists cartage_zone_members (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references cartage_zones(id) on delete cascade,
  match_type text not null check (match_type in ('postcode','postcode_range','suburb','city')),
  value text not null,
  value_to text,
  created_at timestamptz not null default now()
);
create unique index if not exists cartage_zone_members_uq on cartage_zone_members (match_type, lower(value));

-- 3. aliases (learning, grows from corrections)
create table if not exists cartage_aliases (
  id uuid primary key default gen_random_uuid(),
  raw text not null,
  zone_id uuid not null references cartage_zones(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid
);
create unique index if not exists cartage_aliases_uq on cartage_aliases (lower(raw));

-- 4. weight bands (customisable)
create table if not exists cartage_weight_bands (
  id uuid primary key default gen_random_uuid(),
  band_code text not null unique,
  label text not null,
  min_kg numeric not null,
  max_kg numeric,
  sort_order int not null default 0,
  active boolean not null default true
);

-- 5. surcharge catalog
create table if not exists cartage_surcharges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  applies_to text not null check (applies_to in ('fcl','ltl')),
  calc text not null check (calc in ('flat','per_container','percent_of_freight','tiered_weight')),
  default_amount numeric,
  trigger text not null default 'manual' check (trigger in ('manual','dest_residential','weight_threshold','auto')),
  active boolean not null default true,
  sort_order int not null default 0
);

-- 6. heavy tiers (over 20t/24t, editable)
create table if not exists cartage_surcharge_tiers (
  id uuid primary key default gen_random_uuid(),
  surcharge_id uuid not null references cartage_surcharges(id) on delete cascade,
  threshold_kg numeric not null,
  amount numeric not null default 0,
  unique (surcharge_id, threshold_kg)
);

-- 7. monthly FAF
create table if not exists cartage_faf (
  id uuid primary key default gen_random_uuid(),
  effective_month date not null unique,
  percent numeric not null,
  note text,
  created_at timestamptz not null default now()
);

-- RLS: staff-only on all 7
do $$
declare t text;
begin
  foreach t in array array[
    'cartage_zones','cartage_zone_members','cartage_aliases',
    'cartage_weight_bands','cartage_surcharges','cartage_surcharge_tiers','cartage_faf'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists staff_all_%s on %I', t, t);
    execute format('create policy staff_all_%s on %I for all using (is_staff()) with check (is_staff())', t, t);
  end loop;
end $$;

-- seeds
insert into cartage_weight_bands (band_code,label,min_kg,max_kg,sort_order) values
 ('B1','0-50 kg',0,50,1),
 ('B2','50-100 kg',50,100,2),
 ('B3','100-250 kg',100,250,3),
 ('B4','250-500 kg',250,500,4),
 ('B5','500-1000 kg',500,1000,5),
 ('B6','1000 kg+',1000,null,6)
on conflict (band_code) do nothing;

insert into cartage_surcharges (code,label,applies_to,calc,trigger,sort_order) values
 ('FCL_HEAVY','Heavy container surcharge','fcl','tiered_weight','weight_threshold',1),
 ('LTL_FAF','Fuel adjustment factor (FAF)','ltl','percent_of_freight','auto',2),
 ('LTL_TAILLIFT','Tail lift','ltl','flat','manual',3),
 ('LTL_RESI','Residential delivery','ltl','flat','dest_residential',4)
on conflict (code) do nothing;

insert into cartage_surcharge_tiers (surcharge_id,threshold_kg,amount)
select s.id, v.threshold_kg, 0
from cartage_surcharges s
join (values (20000::numeric),(24000::numeric)) as v(threshold_kg) on true
where s.code='FCL_HEAVY'
on conflict (surcharge_id,threshold_kg) do nothing;

insert into cartage_faf (effective_month,percent,note)
values (date_trunc('month',now())::date, 0, 'Set monthly in Setup')
on conflict (effective_month) do nothing;

notify pgrst, 'reload schema';

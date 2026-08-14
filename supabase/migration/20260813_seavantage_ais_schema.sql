-- SeaVantage integration: per-container registration state, per-booking sync toggles,
-- and a staff-only AIS vessel-positions store. Idempotent.
alter table public.booking_containers
  add column if not exists seavantage_document_id text,
  add column if not exists seavantage_registered_at timestamptz;

alter table public.booking_tracking
  add column if not exists seavantage_enabled boolean not null default true,
  add column if not exists last_seavantage_sync timestamptz,
  add column if not exists seavantage_error text;

create table if not exists public.vessel_positions (
  id                 bigint generated always as identity primary key,
  imo                text,
  mmsi               text,
  vessel_key         text generated always as (coalesce(imo, mmsi)) stored,
  ship_name          text,
  ship_type          text,
  ship_type_size     text,
  nation_code        text,
  latitude           numeric(12,8) not null,
  longitude          numeric(12,8) not null,
  speed_over_ground  real,
  course_over_ground real,
  true_heading       smallint,
  nvg_status         smallint,
  ais_destination    text,
  ais_eta            text,
  position_timestamp timestamptz not null,
  static_datetime    timestamptz,
  source             text not null default 'seavantage',
  raw                jsonb,
  received_at        timestamptz not null default now()
);

create unique index if not exists vessel_positions_key_ts_uidx
  on public.vessel_positions (vessel_key, position_timestamp)
  where vessel_key is not null;
create index if not exists vessel_positions_imo_ts_idx
  on public.vessel_positions (imo, position_timestamp desc);

alter table public.vessel_positions enable row level security;
drop policy if exists staff_all_vessel_positions on public.vessel_positions;
create policy staff_all_vessel_positions on public.vessel_positions
  for all using (public.is_staff()) with check (public.is_staff());

create or replace view public.vessel_positions_latest as
select distinct on (vessel_key) *
from public.vessel_positions
where vessel_key is not null
order by vessel_key, position_timestamp desc;

notify pgrst, 'reload schema';

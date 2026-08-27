-- ============================================================
-- Dispatch / Navman (Teletrac TN360) fleet tracking — schema, view, RPC, RLS, cron.
-- Applied live to cpnkudbdzgnzmodhsrbf on 26–27 Aug 2026 via MCP.
-- Repo-parity copy for supabase/migration (singular). Idempotent (safe to re-run).
--
-- Separate namespace from the tms_* mobile-app tables: dispatch_* holds the
-- Navman-synced fleet (poller = supabase/functions/navman-refresh). The dispatch
-- truck map reads get_dispatch_fleet_positions() -> dispatch_vehicle_positions_latest.
-- Also adds route_seq / route_eta to tms_consignments (written by
-- supabase/functions/dispatch-route, the on-demand driver-route + ETA function).
-- ============================================================

-- ---------- dispatch_vehicles (Navman roster) ----------
create table if not exists public.dispatch_vehicles (
  tn_vehicle_id      bigint primary key,
  tn_device_id       bigint,
  tn_company_id      bigint,
  tn_external_id     text,
  name               text,
  registration       text,
  registration_state text,
  vin                text,
  make               text,
  model              text,
  vehicle_type       text,
  vehicle_type_code  text,
  status             text,
  is_active          boolean not null default true,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------- dispatch_drivers (Navman users) ----------
create table if not exists public.dispatch_drivers (
  tn_user_id     bigint primary key,
  first_name     text,
  last_name      text,
  full_name      text,
  email          text,
  licence_number text,
  licence_state  text,
  user_type      text,
  status         text,
  tn_company_id  bigint,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- dispatch_vehicle_positions (GPS breadcrumbs) ----------
create table if not exists public.dispatch_vehicle_positions (
  id                 bigint generated always as identity primary key,
  tn_vehicle_id      bigint not null,
  latitude           numeric,
  longitude          numeric,
  speed              numeric,
  heading            numeric,
  altitude           numeric,
  nsat               smallint,
  hdop               numeric,
  location           text,
  last_event_type    text,
  last_event_subtype text,
  odometer           numeric,
  driver_user_id     bigint,
  position_timestamp timestamptz not null,
  source             text not null default 'navman',
  raw                jsonb,
  received_at        timestamptz not null default now()
);

-- FK + dedup unique key (the navman-refresh upsert conflict target).
-- Guarded because ADD CONSTRAINT has no IF NOT EXISTS.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dispatch_vehicle_positions_tn_vehicle_id_fkey') then
    alter table public.dispatch_vehicle_positions
      add constraint dispatch_vehicle_positions_tn_vehicle_id_fkey
      foreign key (tn_vehicle_id) references public.dispatch_vehicles(tn_vehicle_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dispatch_vehicle_positions_tn_vehicle_id_position_timestamp_key') then
    alter table public.dispatch_vehicle_positions
      add constraint dispatch_vehicle_positions_tn_vehicle_id_position_timestamp_key
      unique (tn_vehicle_id, position_timestamp);
  end if;
end $$;

create index if not exists dispatch_vehicle_positions_veh_ts_idx
  on public.dispatch_vehicle_positions (tn_vehicle_id, position_timestamp desc);

-- ---------- latest-position-per-vehicle view ----------
-- Plain view (owner rights). Intended read path is get_dispatch_fleet_positions(),
-- which joins RLS-gated dispatch_vehicles so non-staff callers see no rows.
create or replace view public.dispatch_vehicle_positions_latest as
  select distinct on (tn_vehicle_id)
    id, tn_vehicle_id, latitude, longitude, speed, heading, altitude, nsat, hdop,
    location, last_event_type, last_event_subtype, odometer, driver_user_id,
    position_timestamp, source, raw, received_at
  from public.dispatch_vehicle_positions p
  order by tn_vehicle_id, position_timestamp desc;

-- ---------- fleet-positions RPC (dispatch map read path) ----------
create or replace function public.get_dispatch_fleet_positions(p_max_age_minutes integer default 10080)
returns table(tn_vehicle_id bigint, name text, registration text, vehicle_type text,
              driver_user_id bigint, driver_name text, latitude numeric, longitude numeric,
              heading numeric, speed numeric, location text, last_event_type text,
              last_event_subtype text, odometer numeric, position_timestamp timestamptz,
              minutes_since numeric)
language sql stable as $fn$
  select
    v.tn_vehicle_id, v.name, v.registration, v.vehicle_type,
    l.driver_user_id, d.full_name as driver_name,
    l.latitude, l.longitude, l.heading, l.speed, l.location,
    l.last_event_type, l.last_event_subtype, l.odometer, l.position_timestamp,
    round(extract(epoch from (now() - l.position_timestamp)) / 60.0, 1) as minutes_since
  from public.dispatch_vehicles v
  join public.dispatch_vehicle_positions_latest l on l.tn_vehicle_id = v.tn_vehicle_id
  left join public.dispatch_drivers d on d.tn_user_id = l.driver_user_id
  where v.is_active
    and l.latitude is not null and l.longitude is not null
    and l.position_timestamp >= now() - make_interval(mins => p_max_age_minutes)
  order by l.position_timestamp desc;
$fn$;

-- ---------- RLS: staff-only (pattern b) ----------
alter table public.dispatch_vehicles          enable row level security;
alter table public.dispatch_drivers           enable row level security;
alter table public.dispatch_vehicle_positions enable row level security;

drop policy if exists staff_all_dispatch_vehicles on public.dispatch_vehicles;
create policy staff_all_dispatch_vehicles on public.dispatch_vehicles
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists staff_all_dispatch_drivers on public.dispatch_drivers;
create policy staff_all_dispatch_drivers on public.dispatch_drivers
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists staff_all_dispatch_vehicle_positions on public.dispatch_vehicle_positions;
create policy staff_all_dispatch_vehicle_positions on public.dispatch_vehicle_positions
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- grants (RLS still gates every row) ----------
grant select, insert, update, delete on
  public.dispatch_vehicles, public.dispatch_drivers, public.dispatch_vehicle_positions
  to authenticated;
grant select on public.dispatch_vehicle_positions_latest to authenticated;
grant execute on function public.get_dispatch_fleet_positions(integer) to authenticated, anon;

-- ---------- dispatch-route output columns on tms_consignments ----------
alter table public.tms_consignments add column if not exists route_seq integer;
alter table public.tms_consignments add column if not exists route_eta timestamptz;

-- ---------- cron: poll Navman every minute (prod only; needs vault secrets) ----------
-- project_url + service_role_key are resolved from vault at RUN time, so scheduling
-- here is safe even where those secrets are absent (the command text is stored, not
-- executed, at migration time). Skipped entirely if pg_cron is not installed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'navman-refresh') then
      perform cron.unschedule('navman-refresh');
    end if;
    perform cron.schedule('navman-refresh', '* * * * *', $cmd$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/navman-refresh',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb
      ) as request_id;
    $cmd$);
  end if;
end $$;

notify pgrst, 'reload schema';

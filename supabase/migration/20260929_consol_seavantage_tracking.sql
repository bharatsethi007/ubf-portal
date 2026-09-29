-- Live tracking for every ERP sea consol (FIS imports + FES exports), not only ones with a console booking.
--   * consol_tracking gains SeaVantage state (carrier, registered refs, last sync, error)
--   * consol_tracking_events: SeaVantage events keyed by consol
--   * consol_sv_registrations: one row per billable SeaVantage registration (audit + daily cap)
--   * consol_track_candidates(): what the worker should refresh next (service role only)
--   * consol_share_links + portal_track_token_v2(): portal / public tracker tokens for consols ('c_' prefix)
--   * cron every 3 hours -> consol-track edge function
-- Idempotent.

alter table public.consol_tracking add column if not exists line_code text;
alter table public.consol_tracking add column if not exists sv_carrier_code text;
alter table public.consol_tracking add column if not exists sv_ref_kind text;
alter table public.consol_tracking add column if not exists sv_refs text[] not null default '{}';
alter table public.consol_tracking add column if not exists last_sv_sync timestamptz;
alter table public.consol_tracking add column if not exists sv_error text;
alter table public.consol_tracking add column if not exists vessel_key text;
alter table public.consol_tracking add column if not exists vessel_name text;

create table if not exists public.consol_tracking_events (
  id bigint generated always as identity primary key,
  consol_key text not null,
  container_no text,
  event_type_code text not null,
  event_datetime timestamptz not null,
  event_location text,
  partner_port_code text,
  event_value text,
  event_value2 text,
  inbound_vessel_name text,
  inbound_vessel_imo bigint,
  operator_scac text,
  source text not null default 'seavantage',
  is_estimated boolean not null default true,
  carrier_event_id text,
  raw jsonb,
  received_at timestamptz not null default now()
);
create unique index if not exists consol_tracking_events_uidx on public.consol_tracking_events (consol_key, carrier_event_id);
create index if not exists consol_tracking_events_key_dt on public.consol_tracking_events (consol_key, event_datetime);
alter table public.consol_tracking_events enable row level security;
drop policy if exists cte_staff_read on public.consol_tracking_events;
create policy cte_staff_read on public.consol_tracking_events for select to authenticated using (public.is_staff());

create table if not exists public.consol_sv_registrations (
  id bigint generated always as identity primary key,
  consol_key text not null,
  ref text not null,
  ref_kind text not null,
  sv_carrier_code text,
  document_id text,
  registered_at timestamptz not null default now(),
  unique (consol_key, ref)
);
alter table public.consol_sv_registrations enable row level security;
drop policy if exists csr_staff_read on public.consol_sv_registrations;
create policy csr_staff_read on public.consol_sv_registrations for select to authenticated using (public.is_staff());

-- Consols the worker should refresh now. Registration is billable, so:
--   * only verified non-Maersk carriers (Maersk stays on the free Maersk API)
--   * skip consols whose linked console booking is already registered with SeaVantage
--   * skip consols staff switched off (consol_tracking.enabled = false with a staff toggle)
create or replace function public.consol_track_candidates(p_limit int default 40, p_min_age interval default interval '3 hours')
returns table (
  consol_key text, module text, line_code text, sv_carrier_code text, ref_kind text, refs text[],
  registered text[], vessel text, eta date, last_sv_sync timestamptz
)
language sql stable security definer set search_path = public as $$
  with base as (
    select s.consol_key, min(s.module) as module, max(s.master_bill) as mbl, max(s.eta) as eta,
           max(s.vessel_flight) as vessel,
           bool_and(coalesce(s.status, '') ilike 'arrived%' and coalesce(s.status, '') not ilike '%est%') as arrived
      from public.shipments s
     where s.module in ('FIS', 'FES') and s.consol_key is not null
       -- ERP status often lags, so a past ETA ends tracking regardless of status.
       and (s.eta between current_date - 5 and current_date + 60 or (s.eta is null and s.etd between current_date - 30 and current_date + 21))
     group by s.consol_key
  ),
  live as (
    select b.* from base b
     where not b.arrived or b.eta >= current_date - 2
  ),
  boxes as (
    select k.consol_key, array_agg(distinct upper(regexp_replace(k.c_number, '\s', '', 'g'))) as cntrs
      from public.containers k join live l on l.consol_key = k.consol_key
     where coalesce(k.c_number, '') <> ''
     group by k.consol_key
  ),
  resolved as (
    select l.*, bx.cntrs,
           upper(regexp_replace(coalesce(l.mbl, ''), '[^A-Za-z0-9]', '', 'g')) as mbl_clean,
           (select m.line_code from public.sv_carrier_map m
             where upper(left(regexp_replace(coalesce(l.mbl, ''), '[^A-Za-z0-9]', '', 'g'), 4)) = any (m.known_prefixes) limit 1) as mbl_line,
           (select m.line_code from public.sv_carrier_map m, unnest(coalesce(bx.cntrs, '{}')) c
             where left(c, 4) = any (m.known_prefixes) limit 1) as box_line
      from live l left join boxes bx on bx.consol_key = l.consol_key
  )
  select r.consol_key, r.module, m.line_code, m.sv_carrier_code,
         case when r.mbl_line is not null then 'mbl' else 'container' end,
         case when r.mbl_line is not null then array[r.mbl_clean] else coalesce(r.cntrs, '{}') end,
         coalesce(ct.sv_refs, '{}'), r.vessel, r.eta, ct.last_sv_sync
    from resolved r
    join public.sv_carrier_map m on m.line_code = coalesce(r.mbl_line, r.box_line)
    left join public.consol_tracking ct on ct.consol_key = r.consol_key
   where m.verified and not m.is_maersk and m.sv_carrier_code is not null
     and (r.mbl_line is not null or coalesce(array_length(r.cntrs, 1), 0) > 0)
     and not (ct.enabled is false and ct.enabled_by is not null)
     and (ct.last_sv_sync is null or ct.last_sv_sync < now() - p_min_age)
     and not exists (
       select 1 from public.bookings bk
         join public.shipments s2 on s2.job_unique = bk.shipment_id
         left join public.booking_tracking bt on bt.booking_id = bk.id
        where s2.consol_key = r.consol_key
          and (bt.seavantage_mbl_registered_at is not null
               or exists (select 1 from public.booking_containers bc where bc.booking_id = bk.id and bc.seavantage_registered_at is not null)))
   order by ct.last_sv_sync nulls first, r.eta
   limit p_limit
$$;
revoke all on function public.consol_track_candidates(int, interval) from public, anon, authenticated;
grant execute on function public.consol_track_candidates(int, interval) to service_role;

-- Tokens for the tracker page. 'c_' prefix routes the client to the consol-track function.
create table if not exists public.consol_share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  consol_key text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '120 days',
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  base_route jsonb
);
create index if not exists consol_share_links_key on public.consol_share_links (consol_key);
alter table public.consol_share_links enable row level security;
drop policy if exists csl_staff_read on public.consol_share_links;
create policy csl_staff_read on public.consol_share_links for select to authenticated using (public.is_staff());

-- Portal: sea shipments track by consol (SeaVantage + linked bookings' PortConnect, merged server side).
-- Air and anything without a consol keep the booking link, if any.
-- v2 so the portal build already deployed keeps using portal_track_token until this code ships.
create or replace function public.portal_track_token_v2(p_job_unique bigint)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_consol text;
  v_booking uuid;
  v_token text;
begin
  if public.my_account_id() is null then return null; end if;
  if not exists (select 1 from public.portal_shipments where job_unique = p_job_unique) then return null; end if;

  select s.consol_key into v_consol from public.shipments s
   where s.job_unique = p_job_unique and s.module in ('FIS', 'FES') and s.consol_key is not null;

  if v_consol is not null then
    select l.token into v_token from public.consol_share_links l
     where l.consol_key = v_consol and l.revoked_at is null and l.expires_at > now() + interval '7 days'
     order by l.expires_at desc limit 1;
    if v_token is null then
      insert into public.consol_share_links (token, consol_key)
      values ('c_' || translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'), v_consol)
      returning token into v_token;
    end if;
    return v_token;
  end if;

  select b.id into v_booking from public.bookings b
   where b.shipment_id = p_job_unique and b.archived_at is null and b.mode = 'sea_import'
   order by b.updated_at desc limit 1;
  if v_booking is null then return null; end if;

  select l.token into v_token from public.booking_share_links l
   where l.booking_id = v_booking and l.revoked_at is null and l.expires_at > now() + interval '7 days'
   order by l.expires_at desc limit 1;
  if v_token is not null then return v_token; end if;

  insert into public.booking_share_links (token, booking_id, created_by, expires_at)
  values (translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'), v_booking, null, now() + interval '90 days')
  returning token into v_token;
  return v_token;
end $$;
revoke all on function public.portal_track_token_v2(bigint) from public, anon;
grant execute on function public.portal_track_token_v2(bigint) to authenticated;

-- Every 3 hours, staggered off the hour.
do $$ begin
  perform cron.unschedule(jobname) from cron.job where jobname = 'consol-sv-refresh';
end $$;
select cron.schedule('consol-sv-refresh', '17 */3 * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/consol-track',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{"mode":"refresh"}'::jsonb,
    timeout_milliseconds := 300000
  );
$c$);

notify pgrst, 'reload schema';

-- Home map: live AIS position of the vessel carrying each of the caller's sea shipments (fresh within 72h).
create or replace function public.portal_live_positions()
returns table (job_unique bigint, lng double precision, lat double precision, heading real, speed_kn real, ship_name text, position_at timestamptz)
language sql stable security definer set search_path = public as $$
  select ps.job_unique, vpl.longitude::double precision, vpl.latitude::double precision,
         coalesce(nullif(vpl.true_heading, 511)::real, vpl.course_over_ground), vpl.speed_over_ground,
         coalesce(vpl.ship_name, ct.vessel_name), vpl.position_timestamp
    from public.portal_shipments ps
    join public.shipments s on s.job_unique = ps.job_unique
    join public.consol_tracking ct on ct.consol_key = s.consol_key and ct.vessel_key is not null
    join public.vessel_positions_latest vpl on vpl.vessel_key = ct.vessel_key
   where public.my_account_id() is not null
     and ps.is_active and s.module in ('FIS', 'FES')
     and vpl.position_timestamp > now() - interval '72 hours'
$$;
revoke all on function public.portal_live_positions() from public, anon;
grant execute on function public.portal_live_positions() to authenticated;

notify pgrst, 'reload schema';

-- SeaVantage (billable) tracking only for new shipments, plus anything staff switch on.
--   tracking_config.sv_auto_from: consols whose first job was created after this are auto-registered with SeaVantage.
--   Older consols are registered only when staff turn on Live tracking in console Shipments (consol_tracking.enabled_by set).
--   Consols already registered keep refreshing (the registration is already paid for).
--   Maersk consols are unaffected: the Maersk API is free, so consol-maersk-track still covers all of them.
--   Turning Live tracking on in the console now refreshes that consol straight away instead of waiting for the 3-hourly run.
-- Idempotent.

create table if not exists public.tracking_config (
  id boolean primary key default true check (id),
  sv_auto_from timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.tracking_config (id, sv_auto_from) values (true, '2026-09-30 00:00:00+13') on conflict do nothing;
alter table public.tracking_config enable row level security;
drop policy if exists staff_all on public.tracking_config;
create policy staff_all on public.tracking_config for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace function public.consol_track_candidates(p_limit integer default 40, p_min_age interval default '03:00:00'::interval)
returns table(consol_key text, module text, line_code text, sv_carrier_code text, ref_kind text, refs text[], registered text[], vessel text, eta date, last_sv_sync timestamptz)
language sql stable security definer set search_path = public as $$
  with base as (
    select s.consol_key, min(s.module) as module, max(s.master_bill) as mbl, max(s.eta) as eta,
           max(s.vessel_flight) as vessel, min(s.created_src) as first_created,
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
     -- Billable: new consols, staff-enabled consols, or ones already registered.
     and (r.first_created >= (select sv_auto_from from public.tracking_config where id)
          or (ct.enabled and ct.enabled_by is not null)
          or coalesce(array_length(ct.sv_refs, 1), 0) > 0)
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

-- Staff switched Live tracking on: refresh that consol now (SeaVantage and Maersk; each skips it if it isn't theirs).
create or replace function public.consol_tracking_refresh_now()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  key text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  hdr jsonb;
begin
  if new.enabled and new.enabled_by is not null and (tg_op = 'INSERT' or old.enabled is distinct from true) and base is not null then
    hdr := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key);
    perform net.http_post(url := base || '/functions/v1/consol-track', headers := hdr,
      body := jsonb_build_object('mode', 'refresh', 'consol', new.consol_key), timeout_milliseconds := 120000);
    perform net.http_post(url := base || '/functions/v1/consol-maersk-track', headers := hdr,
      body := jsonb_build_object('consol', new.consol_key), timeout_milliseconds := 120000);
  end if;
  return new;
end $$;
drop trigger if exists trg_consol_tracking_refresh_now on public.consol_tracking;
create trigger trg_consol_tracking_refresh_now after insert or update of enabled on public.consol_tracking
  for each row execute function public.consol_tracking_refresh_now();

notify pgrst, 'reload schema';

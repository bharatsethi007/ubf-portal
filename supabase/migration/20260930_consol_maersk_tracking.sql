-- Maersk consol tracking (free, Maersk Track & Trace DCSA API).
-- Live ERP sea consols carried by Maersk: a 9-digit numeric MBL (Maersk transport document number), or a Maersk-owned
-- container prefix from sv_carrier_map. SeaVantage skips these (is_maersk), so they had no tracking at all.
-- consol-track's refresh cron calls this and stores DCSA events on consol_tracking_events (source 'carrier').
-- Idempotent.

create or replace function public.consol_maersk_candidates(p_limit int default 40, p_min_age interval default '3 hours')
returns table(consol_key text, module text, mbl text, containers text[], eta date, last_sync timestamptz)
language sql stable security definer set search_path = public as $$
  with base as (
    select s.consol_key, min(s.module) module, max(s.master_bill) mbl, max(s.eta) eta,
           bool_and(coalesce(s.status, '') ilike 'arrived%' and coalesce(s.status, '') not ilike '%est%') arrived
      from public.shipments s
     where s.module in ('FIS', 'FES') and s.consol_key is not null
       and (s.eta between current_date - 5 and current_date + 60 or (s.eta is null and s.etd between current_date - 30 and current_date + 21))
     group by s.consol_key
  ),
  live as (select * from base b where not b.arrived or b.eta >= current_date - 2),
  boxes as (
    select k.consol_key, array_agg(distinct upper(regexp_replace(k.c_number, '\s', '', 'g'))) cntrs
      from public.containers k join live l on l.consol_key = k.consol_key
     where coalesce(k.c_number, '') <> ''
     group by k.consol_key
  ),
  mk as (select known_prefixes from public.sv_carrier_map where is_maersk limit 1)
  select l.consol_key, l.module,
         case when regexp_replace(coalesce(l.mbl, ''), '\s', '', 'g') ~ '^\d{9}$' then regexp_replace(l.mbl, '\s', '', 'g') end,
         coalesce(bx.cntrs, '{}'), l.eta, ct.last_sv_sync
    from live l
    left join boxes bx on bx.consol_key = l.consol_key
    left join public.consol_tracking ct on ct.consol_key = l.consol_key
   where (regexp_replace(coalesce(l.mbl, ''), '\s', '', 'g') ~ '^\d{9}$'
          or exists (select 1 from unnest(coalesce(bx.cntrs, '{}')) c, mk where left(c, 4) = any (mk.known_prefixes)))
     and not (ct.enabled is false and ct.enabled_by is not null)
     and (ct.last_sv_sync is null or ct.last_sv_sync < now() - p_min_age)
   order by ct.last_sv_sync nulls first, l.eta
   limit greatest(0, least(coalesce(p_limit, 40), 200))
$$;
revoke all on function public.consol_maersk_candidates(int, interval) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Every 3 hours at :47 (consol-track SeaVantage runs at :17).
select cron.unschedule(jobid) from cron.job where jobname = 'consol-maersk-refresh';
select cron.schedule('consol-maersk-refresh', '47 */3 * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/consol-maersk-track',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{"limit":80}'::jsonb, timeout_milliseconds := 300000);
$c$);

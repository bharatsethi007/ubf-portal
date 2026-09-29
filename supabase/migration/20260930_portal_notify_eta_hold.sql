-- ETA changes wait 2 hours before notifying. A typo fixed inside that window never reaches the customer;
-- a further change restarts the clock so only the settled ETA is sent. Applied via MCP 30 Sep 2026.
-- Patches the ETA block of portal_notify_scan() in place (the rest of the function is unchanged).
alter table public.portal_notify_state
  add column if not exists pending_eta date,
  add column if not exists pending_since timestamptz;

do $mig$
declare
  src text := pg_get_functiondef('public.portal_notify_scan()'::regprocedure);
  pat text := $p$insert into public\.portal_notifications \(account_id, job_unique, kind, dedupe_key, title, body, facts\)\s*select s\.account_id, s\.job_unique, 'eta_changed'.*?where portal_notify_state\.eta is distinct from excluded\.eta;$p$;
  rep text := $r$-- ETA hold: clear a pending change the ERP has reverted (typo fixed).
  update public.portal_notify_state st set pending_eta = null, pending_since = null
    from _s s
   where s.job_unique = st.job_unique and st.pending_eta is not null and s.eta is not distinct from st.eta;

  -- Start (or restart) the 2-hour clock on a new ETA.
  update public.portal_notify_state st set pending_eta = s.eta, pending_since = now()
    from _s s
   where s.job_unique = st.job_unique and s.eta is not null and st.eta is not null and s.eta <> st.eta
     and st.pending_eta is distinct from s.eta;

  -- Notify once the new ETA has held for 2 hours.
  insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
  select s.account_id, s.job_unique, 'eta_changed',
         'eta:' || s.job_unique || ':' || st.eta || '>' || s.eta || ':' || extract(epoch from st.pending_since)::bigint,
         s.shipment_no || ' ETA ' || case when s.eta > st.eta then 'later' else 'earlier' end || ': ' || to_char(s.eta, 'FMDD Mon'),
         'Estimated arrival moved from ' || to_char(st.eta, 'FMDD Mon') || ' to ' || to_char(s.eta, 'FMDD Mon')
           || ' (' || case when s.eta > st.eta then '+' else '' end || (s.eta - st.eta) || ' days).',
         jsonb_build_object('shipment_no', s.shipment_no, 'origin', s.origin, 'destination', s.destination, 'mode', s.mode,
                            'eta', s.eta, 'old_eta', st.eta, 'party', s.party, 'ref', s.customer_ref, 'vessel', s.vessel_flight)
    from _s s join public.portal_notify_state st on st.job_unique = s.job_unique
   where s.eta is not null and st.eta is not null and s.eta <> st.eta
     and st.pending_eta = s.eta and st.pending_since <= now() - interval '2 hours'
     and s.arrived is null and s.status not ilike 'arrived%'
     and s.eta >= current_date - 2
  on conflict do nothing;

  -- Settled: the held ETA becomes the new baseline.
  update public.portal_notify_state st set eta = s.eta, pending_eta = null, pending_since = null, updated_at = now()
    from _s s
   where s.job_unique = st.job_unique and st.pending_eta = s.eta and st.pending_since <= now() - interval '2 hours';

  -- First sighting: record the baseline, no notice.
  insert into public.portal_notify_state (job_unique, eta)
  select job_unique, eta from _s where eta is not null
  on conflict (job_unique) do nothing;$r$;
  out text;
begin
  out := regexp_replace(src, pat, rep);
  if out = src then raise exception 'ETA block not found in portal_notify_scan'; end if;
  execute out;
end $mig$;

-- Go live: WhatsApp updates to every customer who linked a number and left it on.
update public.portal_notify_config set wa_enabled = true, wa_test_recipient = null where id;

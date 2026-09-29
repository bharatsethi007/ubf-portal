-- Customer notifications for the portal.
--   portal_notify_config  singleton: master email switch, optional test recipient, start time.
--   portal_notifications  one row per event per account; the portal bell reads these, the sender emails them.
--   portal_notify_prefs   per portal user: email opt-in (off by default), event kinds switched off, when they last opened the bell.
--   portal_notify_state   last ETA we told the customer about, per shipment (for ETA-change detection).
--   portal_notify_scan()  cron every 30 min. Only fires on real data: ERP actual dates, tracked carrier/port events,
--                         new ERP jobs and invoices. Never on schedule guesses. Nothing before config.started_at.
-- Idempotent.

create table if not exists public.portal_notify_config (
  id boolean primary key default true check (id),
  email_enabled boolean not null default false,
  test_recipient text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.portal_notify_config (id) values (true) on conflict do nothing;
alter table public.portal_notify_config enable row level security;
drop policy if exists staff_all on public.portal_notify_config;
create policy staff_all on public.portal_notify_config for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.portal_notifications (
  id bigint generated always as identity primary key,
  account_id text not null references public.customers(account_id) on delete cascade,
  job_unique bigint,
  invoice_no text,
  kind text not null check (kind in ('shipment_created', 'eta_changed', 'departed', 'arrived', 'released', 'invoice_issued')),
  dedupe_key text not null,
  title text not null,
  body text,
  facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'skipped', 'failed')),
  emailed_at timestamptz,
  unique (account_id, dedupe_key)
);
create index if not exists portal_notifications_account on public.portal_notifications (account_id, created_at desc);
create index if not exists portal_notifications_pending on public.portal_notifications (created_at) where email_status = 'pending';
alter table public.portal_notifications enable row level security;
drop policy if exists own_read on public.portal_notifications;
create policy own_read on public.portal_notifications for select to authenticated using (account_id = public.my_account_id() or public.is_staff());
grant select on public.portal_notifications to authenticated;

create table if not exists public.portal_notify_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  off_kinds text[] not null default '{}',
  seen_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.portal_notify_prefs enable row level security;
drop policy if exists own_rows on public.portal_notify_prefs;
create policy own_rows on public.portal_notify_prefs for all to authenticated
  using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid());
grant select, insert, update on public.portal_notify_prefs to authenticated;

create table if not exists public.portal_notify_state (
  job_unique bigint primary key,
  eta date,
  updated_at timestamptz not null default now()
);
alter table public.portal_notify_state enable row level security;

-- ---------- scan ----------
create or replace function public.portal_notify_scan()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg record;
  n_before bigint;
  n_after bigint;
begin
  select * into cfg from public.portal_notify_config where id;
  select count(*) into n_before from public.portal_notifications;
  drop table if exists _acc, _s, _ev;

  create temp table _acc on commit drop as
    select distinct account_id from public.portal_users where status = 'active';

  create temp table _s on commit drop as
    select s.job_unique, s.customer_account_id account_id, s.module, s.mode, s.direction, s.origin, s.destination,
           s.vessel_flight, s.etd, s.eta, s.departed, s.arrived, s.status, s.created_src, s.consol_key, s.customer_ref,
           case when s.direction = 'export' then s.consignee_name else s.shipper_name end party,
           case when s.module like 'FI%' and s.shipment_no is not null
                  then s.module || '-' || s.shipment_no || case when coalesce(s.job_no, 1) > 1 then '/' || s.job_no else '' end
                else coalesce(s.job_no::text, s.house_bill) end shipment_no
      from public.shipments s join _acc a on a.account_id = s.customer_account_id
     where s.doc_date >= current_date - 180;

  -- Actual carrier / port events per shipment: its consol, and any portal booking linked to it.
  create temp table _ev on commit drop as
    select s.job_unique, e.event_type_code code, e.event_datetime at, upper(coalesce(e.partner_port_code, '')) port, e.received_at, e.container_no
      from _s s join public.consol_tracking_events e on e.consol_key = s.consol_key and not coalesce(e.is_estimated, false)
    union all
    select s.job_unique, e.event_type_code, e.event_datetime, upper(coalesce(e.partner_port_code, '')), e.received_at, e.container_no
      from _s s join public.bookings b on b.shipment_id = s.job_unique
      join public.tracking_events e on e.booking_id = b.id and not coalesce(e.is_estimated, false);

  -- New ERP jobs (portal bookings already get their own "now a shipment" email).
  insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
  select s.account_id, s.job_unique, 'shipment_created', 'new:' || s.job_unique,
         'New shipment ' || s.shipment_no,
         'We have opened shipment ' || s.shipment_no || coalesce(' from ' || s.origin, '') || coalesce(' to ' || s.destination, '') || '.',
         jsonb_build_object('shipment_no', s.shipment_no, 'origin', s.origin, 'destination', s.destination, 'mode', s.mode,
                            'etd', s.etd, 'eta', s.eta, 'party', s.party, 'ref', s.customer_ref, 'vessel', s.vessel_flight)
    from _s s
   where s.created_src >= cfg.started_at
     and not exists (select 1 from public.bookings b where b.shipment_id = s.job_unique)
  on conflict do nothing;

  -- Departed: ERP actual date, or first actual departure event.
  insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
  select s.account_id, s.job_unique, 'departed', 'dep:' || s.job_unique,
         s.shipment_no || ' has departed',
         case when s.mode = 'air' then 'The flight' else 'The vessel' end || coalesce(' ' || s.vessel_flight, '') || ' left ' || coalesce(s.origin, 'origin')
           || ' on ' || to_char(d.at, 'FMDD Mon') || '.' || coalesce(' Estimated arrival ' || to_char(s.eta, 'FMDD Mon') || '.', ''),
         jsonb_build_object('shipment_no', s.shipment_no, 'origin', s.origin, 'destination', s.destination, 'mode', s.mode,
                            'departed', d.at, 'eta', s.eta, 'party', s.party, 'ref', s.customer_ref, 'vessel', s.vessel_flight)
    from _s s
    cross join lateral (
      select coalesce(
        (select min(e.at)::date from _ev e where e.job_unique = s.job_unique and e.code in ('VD', 'DEPA') and e.received_at >= cfg.started_at),
        case when s.departed >= cfg.started_at::date then s.departed end) at
    ) d
   where d.at is not null
  on conflict do nothing;

  -- Arrived: ERP actual date, port arrival, or carrier arrival at the destination port.
  insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
  select s.account_id, s.job_unique, 'arrived', 'arr:' || s.job_unique,
         s.shipment_no || ' has arrived',
         'Your shipment arrived at ' || coalesce(s.destination, 'destination') || ' on ' || to_char(a.at, 'FMDD Mon') || '.',
         jsonb_build_object('shipment_no', s.shipment_no, 'origin', s.origin, 'destination', s.destination, 'mode', s.mode,
                            'arrived', a.at, 'party', s.party, 'ref', s.customer_ref, 'vessel', s.vessel_flight)
    from _s s
    cross join lateral (
      select coalesce(
        (select min(e.at)::date from _ev e where e.job_unique = s.job_unique and e.received_at >= cfg.started_at
            and ((e.code = 'VESSELARRIVAL' and s.direction = 'import') or (e.code in ('VA', 'ARRI') and e.port = upper(coalesce(s.destination, '#'))))),
        case when s.arrived >= cfg.started_at::date then s.arrived end) at
    ) a
   where a.at is not null
  on conflict do nothing;

  -- Released at port: customs and MPI both released for a container (PortConnect, NZ imports).
  insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
  select s.account_id, s.job_unique, 'released', 'rel:' || s.job_unique || ':' || r.container_no,
         r.container_no || ' released at port',
         'Customs and MPI have released container ' || r.container_no || ' on shipment ' || s.shipment_no || ' at ' || coalesce(s.destination, 'the port') || '.',
         jsonb_build_object('shipment_no', s.shipment_no, 'container', r.container_no, 'destination', s.destination,
                            'released', r.at, 'party', s.party, 'ref', s.customer_ref)
    from _s s
    join (
      select job_unique, container_no, max(at) at
        from _ev where code in ('CUSTOMSRELEASE', 'MPIRELEASE') and container_no is not null
       group by 1, 2
      having count(distinct code) = 2 and max(received_at) >= (select started_at from public.portal_notify_config where id)
    ) r on r.job_unique = s.job_unique
   where s.direction = 'import'
  on conflict do nothing;

  -- ETA changes: compare with the last ETA we saw. First sighting is a silent baseline.
  insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
  select s.account_id, s.job_unique, 'eta_changed', 'eta:' || s.job_unique || ':' || s.eta,
         s.shipment_no || ' ETA ' || case when s.eta > st.eta then 'later' else 'earlier' end || ': ' || to_char(s.eta, 'FMDD Mon'),
         'Estimated arrival moved from ' || to_char(st.eta, 'FMDD Mon') || ' to ' || to_char(s.eta, 'FMDD Mon')
           || ' (' || case when s.eta > st.eta then '+' else '' end || (s.eta - st.eta) || ' days).',
         jsonb_build_object('shipment_no', s.shipment_no, 'origin', s.origin, 'destination', s.destination, 'mode', s.mode,
                            'eta', s.eta, 'old_eta', st.eta, 'party', s.party, 'ref', s.customer_ref, 'vessel', s.vessel_flight)
    from _s s join public.portal_notify_state st on st.job_unique = s.job_unique
   where s.eta is not null and st.eta is not null and s.eta <> st.eta
     and s.arrived is null and s.status not ilike 'arrived%'
     and s.eta >= current_date - 2
  on conflict do nothing;

  insert into public.portal_notify_state (job_unique, eta)
  select job_unique, eta from _s where eta is not null
  on conflict (job_unique) do update set eta = excluded.eta, updated_at = now()
   where portal_notify_state.eta is distinct from excluded.eta;

  -- New invoices.
  insert into public.portal_notifications (account_id, job_unique, invoice_no, kind, dedupe_key, title, body, facts)
  select i.account_id, i.job_unique, i.invoice_no, 'invoice_issued', 'inv:' || i.invoice_no,
         'Invoice ' || i.invoice_no || ' issued',
         coalesce(i.currency, 'NZD') || ' ' || to_char(coalesce(i.amt_foreign, i.amt_local), 'FM999,999,990.00')
           || ' due ' || to_char(coalesce(i.date_due, i.doc_date + 30), 'FMDD Mon') || coalesce(' for shipment ' || s.shipment_no, '') || '.',
         jsonb_build_object('invoice_no', i.invoice_no, 'currency', coalesce(i.currency, 'NZD'), 'amount', coalesce(i.amt_foreign, i.amt_local),
                            'due', coalesce(i.date_due, i.doc_date + 30), 'shipment_no', s.shipment_no, 'doctype', i.doctype)
    from public.invoices i
    join _acc a on a.account_id = i.account_id
    left join _s s on s.job_unique = i.job_unique
   where i.doc_date >= cfg.started_at::date
  on conflict do nothing;

  select count(*) into n_after from public.portal_notifications;
  return jsonb_build_object('new', n_after - n_before, 'shipments', (select count(*) from _s));
end $$;
revoke all on function public.portal_notify_scan() from public, anon, authenticated;

-- ---------- portal-side helpers ----------
create or replace function public.portal_notify_mark_seen()
returns void language sql security definer set search_path = public as $$
  insert into public.portal_notify_prefs (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = now(), updated_at = now();
$$;
revoke all on function public.portal_notify_mark_seen() from public, anon;
grant execute on function public.portal_notify_mark_seen() to authenticated;

create or replace function public.portal_notify_set_prefs(p_email boolean, p_off_kinds text[])
returns void language sql security definer set search_path = public as $$
  insert into public.portal_notify_prefs (user_id, email_enabled, off_kinds)
  values (auth.uid(), coalesce(p_email, false), coalesce(p_off_kinds, '{}'))
  on conflict (user_id) do update set email_enabled = excluded.email_enabled, off_kinds = excluded.off_kinds, updated_at = now();
$$;
revoke all on function public.portal_notify_set_prefs(boolean, text[]) from public, anon;
grant execute on function public.portal_notify_set_prefs(boolean, text[]) to authenticated;

-- ---------- sender feed (service role only) ----------
-- Pending notifications grouped per recipient, with each user's preferences applied.
create or replace function public.portal_notify_outbox(p_limit int default 200)
returns jsonb language sql stable security definer set search_path = public as $$
  with pend as (
    select * from public.portal_notifications where email_status = 'pending' order by created_at limit greatest(1, least(p_limit, 1000))
  ),
  rcpt as (
    select u.user_id, u.email, u.display_name, u.account_id, coalesce(p.email_enabled, false) on_, coalesce(p.off_kinds, '{}') off_
      from public.portal_users u left join public.portal_notify_prefs p on p.user_id = u.user_id
     where u.status = 'active' and u.email is not null
  )
  select jsonb_build_object(
    'config', (select to_jsonb(c) from public.portal_notify_config c where id),
    'ids', coalesce((select jsonb_agg(id) from pend), '[]'::jsonb),
    'recipients', coalesce((
      select jsonb_agg(jsonb_build_object('email', r.email, 'name', r.display_name, 'account_id', r.account_id,
               'customer', (select name from public.customers c where c.account_id = r.account_id),
               'items', (select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
                                                              'facts', n.facts, 'job_unique', n.job_unique, 'invoice_no', n.invoice_no) order by n.created_at)
                           from pend n where n.account_id = r.account_id and not (n.kind = any (r.off_))))
             )
        from rcpt r
       where r.on_ and exists (select 1 from pend n where n.account_id = r.account_id and not (n.kind = any (r.off_)))), '[]'::jsonb)
  )
$$;
revoke all on function public.portal_notify_outbox(int) from public, anon, authenticated;

create or replace function public.portal_notify_mark(p_ids bigint[], p_status text)
returns void language sql security definer set search_path = public as $$
  update public.portal_notifications set email_status = p_status, emailed_at = now()
   where id = any (p_ids) and email_status = 'pending';
$$;
revoke all on function public.portal_notify_mark(bigint[], text) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ---------- schedules ----------
-- Scan every 30 min. Email hourly at :05 during NZ daytime (18:00-06:59 UTC).
select cron.unschedule(jobid) from cron.job where jobname in ('portal-notify-scan', 'portal-notify-send');
select cron.schedule('portal-notify-scan', '*/30 * * * *', 'select public.portal_notify_scan();');
select cron.schedule('portal-notify-send', '5 18-23,0-6 * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-notify-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$c$);

-- Email is opt-in per portal user; the master switch stays on so opted-in users get their digest.
update public.portal_notify_config set email_enabled = true, test_recipient = null, updated_at = now() where id;

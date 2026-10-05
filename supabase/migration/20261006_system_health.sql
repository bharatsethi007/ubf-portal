-- System Health: API call log, probes, TWF sync runs, storage snapshots, staff RPCs.
-- Applied via Supabase MCP 6 Oct 2026 (split into 5 migrations). Repo parity copy, do not re-run.
-- PENDING: system-health-retention cron (needs approval in chat, last block below).

-- ── Providers ────────────────────────────────────────────────────────────────
create table if not exists public.api_providers (
  code        text primary key,
  name        text not null,
  category    text not null,
  important   boolean not null default false,
  log_bodies  boolean not null default false,
  hosts       text[] not null default '{}',
  probe_url   text,
  probe_auth  boolean not null default false,
  cost_note   text,
  sort_order  int not null default 100,
  active      boolean not null default true
);

insert into public.api_providers (code, name, category, important, log_bodies, hosts, probe_url, probe_auth, cost_note, sort_order) values
 ('anthropic',     'Anthropic Claude',   'AI',        true,  false, '{api.anthropic.com}',                      'https://api.anthropic.com/v1/models',                                     true,  'Per token',          10),
 ('deepgram',      'Deepgram',           'AI',        false, false, '{api.deepgram.com}',                       'https://api.deepgram.com/v1/projects',                                    false, 'Per audio minute',   20),
 ('brevo',         'Brevo',              'Messaging', true,  true,  '{api.brevo.com}',                          'https://api.brevo.com/v3/account',                                        true,  'Plan quota',         30),
 ('msgraph',       'Microsoft Graph',    'Messaging', true,  true,  '{graph.microsoft.com,login.microsoftonline.com}', 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration', false, 'Free', 40),
 ('whatsapp',      'WhatsApp Cloud',     'Messaging', true,  true,  '{graph.facebook.com}',                     'https://graph.facebook.com/',                                             false, 'Per conversation',   50),
 ('portconnect',   'PortConnect',        'Tracking',  true,  true,  '{api.portconnect.io}',                     'https://api.portconnect.io/',                                             false, 'Per call',           60),
 ('maersk',        'Maersk DCSA',        'Tracking',  true,  true,  '{api.maersk.com}',                         'https://api.maersk.com/',                                                 false, 'Free',               70),
 ('seavantage',    'SeaVantage',         'Tracking',  true,  true,  '{insight.seavantage.com}',                 'https://insight.seavantage.com/',                                         false, 'Per container',      80),
 ('navman',        'Navman TN360',       'TMS',       true,  false, '{api-au.telematics.com}',                  'https://api-au.telematics.com/',                                          false, 'Subscription',       90),
 ('google_routes', 'Google Routes',      'TMS',       false, false, '{routes.googleapis.com}',                  'https://routes.googleapis.com/',                                          false, 'Per request',       100),
 ('mapbox',        'Mapbox',             'TMS',       false, false, '{api.mapbox.com}',                         'https://api.mapbox.com/',                                                 false, 'Map loads (browser)',110),
 ('dhl',           'DHL Express',        'Courier',   true,  true,  '{express.api.dhl.com}',                    'https://express.api.dhl.com/',                                            false, 'Free',              120),
 ('fedex',         'FedEx',              'Courier',   true,  true,  '{apis.fedex.com}',                         'https://apis.fedex.com/',                                                 false, 'Free',              130),
 ('bascik',        'Bascik',             'Courier',   false, true,  '{api.bascik.co.nz,apitest.bascik.co.nz}', 'https://api.bascik.co.nz/',                                               false, 'Free',              140),
 ('gss',           'GoSweetSpot',        'Courier',   false, true,  '{api.gosweetspot.com}',                    'https://api.gosweetspot.com/',                                            false, 'Free',              150),
 ('s3',            'AWS S3',             'Storage',   true,  false, '{ubf-portal-files-akl.s3.ap-southeast-6.amazonaws.com}', null,                                        true,  'Per GB + requests',  160)
on conflict (code) do nothing;

-- ── Call log (written by _shared/apiFetch.ts) ───────────────────────────────
create table if not exists public.api_calls (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  provider  text not null,
  fn        text,
  method    text,
  host      text,
  path      text,
  status    int,
  ok        boolean not null default false,
  ms        int,
  bytes_out int,
  bytes_in  int,
  error     text,
  req_body  text,
  res_body  text
);
create index if not exists api_calls_provider_at_idx on public.api_calls (provider, at desc);
create index if not exists api_calls_at_idx on public.api_calls (at desc);

-- ── Probe results (written by system-probe) ─────────────────────────────────
create table if not exists public.api_health_checks (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  provider  text not null,
  ok        boolean not null,
  status    int,
  ms        int,
  error     text
);
create index if not exists api_health_checks_provider_at_idx on public.api_health_checks (provider, at desc);

-- ── TWF / FDB sync runs (written by on-prem python) ─────────────────────────
create table if not exists public.sync_runs (
  id            bigserial primary key,
  source        text not null default 'TWF-NZ',
  script        text,
  host          text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running' check (status in ('running','ok','error')),
  modules       jsonb,
  rows_written  int,
  message       text,
  log           text
);
create index if not exists sync_runs_started_idx on public.sync_runs (started_at desc);

-- ── S3 snapshots (written by system-probe nightly) ──────────────────────────
create table if not exists public.storage_snapshots (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  area     text not null,
  objects  int not null,
  bytes    bigint not null
);
create index if not exists storage_snapshots_at_idx on public.storage_snapshots (at desc);

-- Freshness indexes for sync tables
create index if not exists shipments_synced_at_idx   on public.shipments (synced_at desc);
create index if not exists job_charges_synced_at_idx on public.job_charges (synced_at desc);
create index if not exists invoices_synced_at_idx    on public.invoices (synced_at desc);

-- ── RLS: staff read, service_role writes ────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['api_providers','api_calls','api_health_checks','sync_runs','storage_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_read_%1$s on public.%1$I', t);
    execute format('create policy staff_read_%1$s on public.%1$I for select to authenticated using (is_staff())', t);
  end loop;
end $$;

-- ── RPC: provider summary ───────────────────────────────────────────────────
create or replace function public.system_api_summary(p_hours int default 24)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(hours => greatest(1, least(coalesce(p_hours,24), 720)));
  r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  with c as (
    select provider, count(*) n, count(*) filter (where not ok) err,
           avg(ms)::int avg_ms, (percentile_cont(0.95) within group (order by ms))::int p95,
           coalesce(sum(bytes_out),0) bo, coalesce(sum(bytes_in),0) bi,
           max(at) filter (where ok) last_ok, max(at) filter (where not ok) last_err
    from api_calls where at >= since group by provider),
  le as (
    select distinct on (provider) provider, status, error
    from api_calls where not ok and at >= since order by provider, at desc),
  hc as (
    select distinct on (provider) provider, ok, status, ms, at, error
    from api_health_checks where at >= now() - interval '2 days' order by provider, at desc),
  up as (
    select provider, round(100.0 * count(*) filter (where ok) / count(*), 1) pct
    from api_health_checks where at >= now() - interval '7 days' group by provider),
  s as (
    select p.code provider, jsonb_agg(coalesce(x.n,0) order by b) series
    from api_providers p
    cross join generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') b
    left join lateral (
      select count(*) n from api_calls a where a.provider = p.code and a.at >= b and a.at < b + interval '1 hour') x on true
    group by p.code)
  select jsonb_agg(jsonb_build_object(
    'code', p.code, 'name', p.name, 'category', p.category, 'important', p.important,
    'log_bodies', p.log_bodies, 'cost_note', p.cost_note,
    'calls', coalesce(c.n,0), 'errors', coalesce(c.err,0), 'avg_ms', c.avg_ms, 'p95_ms', c.p95,
    'bytes_out', coalesce(c.bo,0), 'bytes_in', coalesce(c.bi,0),
    'last_ok', c.last_ok, 'last_err', c.last_err, 'last_err_msg', le.error, 'last_err_status', le.status,
    'probe_ok', hc.ok, 'probe_status', hc.status, 'probe_ms', hc.ms, 'probe_at', hc.at, 'probe_err', hc.error,
    'uptime_7d', up.pct, 'series', s.series
  ) order by p.sort_order) into r
  from api_providers p
  left join c  on c.provider  = p.code
  left join le on le.provider = p.code
  left join hc on hc.provider = p.code
  left join up on up.provider = p.code
  left join s  on s.provider  = p.code
  where p.active;
  return coalesce(r, '[]'::jsonb);
end $$;

-- ── RPC: call log ───────────────────────────────────────────────────────────
create or replace function public.system_api_log(
  p_provider text default null, p_errors_only boolean default false, p_limit int default 100, p_before bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; q text;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  q := 'select coalesce(jsonb_agg(to_jsonb(t) order by t.id desc), ''[]'') from (select * from api_calls where true';
  if p_provider is not null then q := q || ' and provider = ' || quote_literal(p_provider); end if;
  if p_errors_only then q := q || ' and not ok'; end if;
  if p_before is not null then q := q || ' and id < ' || p_before::text; end if;
  q := q || ' order by id desc limit ' || greatest(1, least(coalesce(p_limit,100), 500))::text || ') t';
  execute q into r;
  return r;
end $$;

-- ── RPC: backend ────────────────────────────────────────────────────────────
create or replace function public.system_backend()
returns jsonb language plpgsql security definer set search_path = public, cron, net as $$
declare r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'db_bytes',  pg_database_size(current_database()),
    'db_limit_bytes', 8::bigint * 1024 * 1024 * 1024,
    'conn_total', (select count(*) from pg_stat_activity),
    'conn_active', (select count(*) from pg_stat_activity where state = 'active'),
    'conn_idle',  (select count(*) from pg_stat_activity where state = 'idle'),
    'conn_max',  current_setting('max_connections')::int,
    'long_queries', (select count(*) from pg_stat_activity where state = 'active' and now() - query_start > interval '30 seconds'),
    'cache_hit', (select round(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 2) from pg_stat_database where datname = current_database()),
    'tables', (select coalesce(jsonb_agg(t), '[]') from (
        select relname as name, pg_total_relation_size(relid) as bytes, n_live_tup as rows
        from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 10) t),
    'cron', (select coalesce(jsonb_agg(x order by x.name), '[]') from (
        select j.jobname as name, j.schedule, j.active,
               l.status as last_status, l.start_time as last_start,
               round(extract(epoch from (l.end_time - l.start_time))::numeric, 2) as last_secs,
               left(l.return_message, 300) as last_msg
        from cron.job j
        left join lateral (select * from cron.job_run_details d where d.jobid = j.jobid order by d.runid desc limit 1) l on true) x),
    'cron_24h', (select jsonb_build_object('ok', count(*) filter (where status = 'succeeded'), 'failed', count(*) filter (where status = 'failed'))
        from cron.job_run_details where start_time > now() - interval '24 hours'),
    'cron_failures', (select coalesce(jsonb_agg(f), '[]') from (
        select j.jobname as name, d.start_time as at, left(d.return_message, 400) as msg
        from cron.job_run_details d join cron.job j on j.jobid = d.jobid
        where d.status = 'failed' and d.start_time > now() - interval '7 days'
        order by d.start_time desc limit 20) f),
    'http_24h', (select jsonb_build_object('total', count(*), 'errors', count(*) filter (where status_code >= 400 or error_msg is not null))
        from net._http_response where created > now() - interval '24 hours'),
    'http_errors', (select coalesce(jsonb_agg(h), '[]') from (
        select created as at, status_code as status, left(coalesce(error_msg, content), 300) as msg
        from net._http_response where created > now() - interval '24 hours' and (status_code >= 400 or error_msg is not null)
        order by created desc limit 20) h)
  ) into r;
  return r;
end $$;

-- ── RPC: storage ────────────────────────────────────────────────────────────
create or replace function public.system_storage()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'latest_at', (select max(at) from storage_snapshots),
    'areas', (select coalesce(jsonb_agg(a order by a.bytes desc), '[]') from (
        select distinct on (area) area, objects, bytes, at from storage_snapshots order by area, at desc) a),
    'trend', (select coalesce(jsonb_agg(d order by d.day), '[]') from (
        select day, sum(bytes) as bytes, sum(objects) as objects from (
          select distinct on (area, at::date) at::date as day, area, bytes, objects
          from storage_snapshots where at > now() - interval '60 days' order by area, at::date, at desc) z
        group by day) d),
    'checks', (select coalesce(jsonb_agg(h order by h.at desc), '[]') from (
        select at, ok, ms, error from api_health_checks where provider = 's3' order by at desc limit 20) h)
  ) into r;
  return r;
end $$;

-- ── RPC: TWF / FDB sync ─────────────────────────────────────────────────────
create or replace function public.system_sync()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'modules', (select coalesce(jsonb_agg(s order by s.module), '[]') from (select module, last_run, last_modified from sync_state) s),
    'tables', jsonb_build_array(
        jsonb_build_object('name', 'Shipments',  'synced_at', (select max(synced_at) from shipments)),
        jsonb_build_object('name', 'Charges',    'synced_at', (select max(synced_at) from job_charges)),
        jsonb_build_object('name', 'Invoices',   'synced_at', (select max(synced_at) from invoices))),
    'runs', (select coalesce(jsonb_agg(x order by x.started_at desc), '[]') from (
        select id, source, script, host, started_at, finished_at, status, modules, rows_written, message,
               left(log, 20000) as log
        from sync_runs order by started_at desc limit 50) x),
    'jobs', (select coalesce(jsonb_agg(j order by j.id desc), '[]') from (
        select id, status, requested_by, requested_at, finished_at, left(message, 2000) as message
        from sync_jobs order by id desc limit 5) j),
    'fx', (select to_jsonb(f) from (select last_applied_at, last_result from fx_sync_state limit 1) f),
    'portconnect_24h', (select jsonb_build_object('ok', count(*) filter (where status = 'ok'), 'total', count(*))
        from portconnect_sync_log where ran_at > now() - interval '24 hours')
  ) into r;
  return r;
end $$;

-- ── RPC: one-shot overall status for header ─────────────────────────────────
create or replace function public.system_overview()
returns jsonb language plpgsql security definer set search_path = public, cron as $$
declare r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'apis_total', (select count(*) from api_providers where active),
    'apis_down',  (select count(*) from (select distinct on (provider) ok from api_health_checks
                    where at > now() - interval '1 hour' order by provider, at desc) h where not h.ok),
    'calls_24h',  (select count(*) from api_calls where at > now() - interval '24 hours'),
    'errors_24h', (select count(*) from api_calls where at > now() - interval '24 hours' and not ok),
    'bytes_24h',  (select coalesce(sum(coalesce(bytes_out,0) + coalesce(bytes_in,0)),0) from api_calls where at > now() - interval '24 hours'),
    'sync_last',  (select max(last_run) from sync_state),
    'db_bytes',   pg_database_size(current_database()),
    's3_bytes',   (select sum(bytes) from (select distinct on (area) bytes from storage_snapshots order by area, at desc) s),
    'cron_failed_24h', (select count(*) from cron.job_run_details where status = 'failed' and start_time > now() - interval '24 hours')
  ) into r;
  return r;
end $$;

revoke all on function public.system_api_summary(int), public.system_api_log(text, boolean, int, bigint),
  public.system_backend(), public.system_storage(), public.system_sync(), public.system_overview() from public, anon;
grant execute on function public.system_api_summary(int), public.system_api_log(text, boolean, int, bigint),
  public.system_backend(), public.system_storage(), public.system_sync(), public.system_overview() to authenticated;

-- ── Cron: probes, storage snapshot, retention ───────────────────────────────
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('system-probe-15m', 'system-storage-nightly', 'system-health-retention');
end $$;

select cron.schedule('system-probe-15m', '*/15 * * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/system-probe',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{"action":"probe"}'::jsonb,
    timeout_milliseconds := 60000);
$c$);

select cron.schedule('system-storage-nightly', '27 14 * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/system-probe',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{"action":"storage"}'::jsonb,
    timeout_milliseconds := 300000);
$c$);

select cron.schedule('system-health-retention', '41 14 * * *', $c$
  update public.api_calls set req_body = null, res_body = null where at < now() - interval '14 days' and (req_body is not null or res_body is not null);
  delete from public.api_calls where at < now() - interval '60 days';
  delete from public.api_health_checks where at < now() - interval '30 days';
  delete from public.sync_runs where started_at < now() - interval '90 days';
$c$);

notify pgrst, 'reload schema';

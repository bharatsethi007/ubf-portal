-- System Health v2: alerts (rules + settings + history) and a unified log stream.
-- Applied via Supabase MCP 6 Oct 2026. Repo parity copy, do not re-run.
-- Writes to system_alerts happen in the system-alerts edge function (service role).

create table if not exists public.system_alert_settings (
  id               boolean primary key default true check (id),
  enabled          boolean not null default true,
  emails           text[]  not null default '{bharats@ubfreight.com}',
  sync_late_hours  int     not null default 3,
  notify_resolved  boolean not null default true,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
insert into public.system_alert_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.system_alerts (
  id                    bigserial primary key,
  key                   text not null,
  kind                  text not null,
  severity              text not null check (severity in ('warn','critical')),
  title                 text not null,
  detail                text,
  opened_at             timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  resolved_at           timestamptz,
  notified_open_at      timestamptz,
  notified_resolved_at  timestamptz
);
create unique index if not exists system_alerts_open_uq on public.system_alerts (key) where resolved_at is null;
create index if not exists system_alerts_opened_idx on public.system_alerts (opened_at desc);

alter table public.system_alert_settings enable row level security;
alter table public.system_alerts enable row level security;
create policy staff_read_system_alert_settings on public.system_alert_settings for select to authenticated using (is_staff());
create policy staff_read_system_alerts on public.system_alerts for select to authenticated using (is_staff());

-- ── Rules: what SHOULD be open right now. Pure read; the edge fn opens/resolves. ──
create or replace function public.system_alert_candidates()
returns table (key text, kind text, severity text, title text, detail text)
language plpgsql security definer set search_path = public, cron as $$
declare s system_alert_settings;
begin
  select * into s from system_alert_settings limit 1;

  -- API unreachable: last 2 probes failed
  return query
  select 'api_down:' || x.provider, 'api_down', 'critical',
         p.name || ' unreachable',
         'Last 2 probes failed. ' || coalesce(max(x.error), '')
  from (select h.provider, h.ok, h.error, row_number() over (partition by h.provider order by h.at desc) rn
        from api_health_checks h where h.at > now() - interval '2 hours') x
  join api_providers p on p.code = x.provider
  where x.rn <= 2
  group by x.provider, p.name
  having count(*) = 2 and bool_and(not x.ok);

  -- API failing in real traffic: >= 5 calls and >= 50% errors in 30 min
  return query
  select 'api_errors:' || a.provider, 'api_errors', 'warn',
         p.name || ' calls failing',
         count(*) filter (where not a.ok) || ' of ' || count(*) || ' calls failed in 30 min. Last: ' ||
           coalesce((array_agg(a.error order by a.at desc) filter (where not a.ok))[1], '')
  from api_calls a join api_providers p on p.code = a.provider
  where a.at > now() - interval '30 minutes'
  group by a.provider, p.name
  having count(*) >= 5 and count(*) filter (where not a.ok)::numeric / count(*) >= 0.5;

  -- TWF sync late
  return query
  select 'sync_stale', 'sync_stale',
         case when max(ss.last_run) < now() - interval '24 hours' then 'critical' else 'warn' end,
         'TWF sync late',
         'Last run ' || to_char(max(ss.last_run) at time zone 'Pacific/Auckland', 'DD Mon HH24:MI') || ' NZ. Expected hourly.'
  from sync_state ss
  having max(ss.last_run) < now() - make_interval(hours => coalesce(s.sync_late_hours, 3));

  -- Latest TWF sync run failed
  return query
  select 'sync_failed', 'sync_failed', 'critical', 'TWF sync failed',
         coalesce(r.message, 'See run log')
  from (select * from sync_runs order by started_at desc limit 1) r
  where r.status = 'error' and r.started_at > now() - interval '24 hours';

  -- Scheduled job failed twice running
  return query
  select 'cron:' || j.jobname, 'cron_failing', 'warn',
         'Job ' || j.jobname || ' failing',
         coalesce(left(l.msg, 300), 'Last 2 runs failed')
  from cron.job j
  cross join lateral (
    select array_agg(z.status order by z.runid desc) st, (array_agg(z.return_message order by z.runid desc))[1] msg
    from (select d.status, d.runid, d.return_message from cron.job_run_details d
          where d.jobid = j.jobid order by d.runid desc limit 2) z) l
  where j.active and l.st = array['failed','failed'];

  -- Database pressure
  return query
  select 'db_conn', 'db_conn', 'warn', 'Database connections high',
         c.n || ' of ' || current_setting('max_connections') || ' in use'
  from (select count(*) n from pg_stat_activity) c
  where c.n > 0.85 * current_setting('max_connections')::int;

  return query
  select 'db_size', 'db_size', 'warn', 'Database over 85% of plan',
         pg_size_pretty(pg_database_size(current_database())) || ' used of 8 GB'
  where pg_database_size(current_database()) > 0.85 * 8::bigint * 1024 * 1024 * 1024;
end $$;
revoke execute on function public.system_alert_candidates() from public, anon, authenticated;

-- ── Settings save (admins only) ──
create or replace function public.system_alert_settings_save(
  p_enabled boolean, p_emails text[], p_sync_late_hours int, p_notify_resolved boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not exists (select 1 from staff_users where user_id = auth.uid() and is_admin) then
    raise exception 'Only admins can change alert settings';
  end if;
  update system_alert_settings set
    enabled = coalesce(p_enabled, enabled),
    emails = coalesce((select array_agg(distinct lower(trim(e))) from unnest(p_emails) e where trim(e) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'), '{}'),
    sync_late_hours = greatest(1, least(coalesce(p_sync_late_hours, sync_late_hours), 72)),
    notify_resolved = coalesce(p_notify_resolved, notify_resolved),
    updated_at = now(), updated_by = auth.uid()
  where id;
  select to_jsonb(s) into r from system_alert_settings s;
  return r;
end $$;

create or replace function public.system_alerts_list(p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'settings', (select to_jsonb(s) from system_alert_settings s),
    'is_admin', exists (select 1 from staff_users where user_id = auth.uid() and is_admin),
    'alerts', (select coalesce(jsonb_agg(to_jsonb(a) order by (a.resolved_at is null) desc, a.opened_at desc), '[]')
               from (select * from system_alerts order by opened_at desc limit greatest(1, least(p_limit, 500))) a)
  ) into r;
  return r;
end $$;

-- ── Unified log rows (internal) ──
create or replace function public.system_log_rows(p_from timestamptz, p_to timestamptz)
returns table (id text, ts timestamptz, source text, level text, kind text, fn text, message text)
language sql stable security definer set search_path = public, cron as $$
  select 'a' || a.id, a.at, a.provider,
         case when not a.ok then 'error' when a.ms > 5000 then 'warn' else 'info' end,
         'api', a.fn,
         coalesce(a.method, '') || ' ' || coalesce(a.path, '') || '  ' || coalesce(a.status::text, 'ERR') ||
           '  ' || coalesce(a.ms::text || 'ms', '') || coalesce('  ' || a.error, '')
  from api_calls a where a.at >= p_from and a.at < p_to
  union all
  select 'h' || h.id, h.at, h.provider, 'error', 'probe', 'system-probe',
         'Probe failed  ' || coalesce(h.status::text, 'no response') || '  ' || coalesce(h.error, '')
  from api_health_checks h where h.at >= p_from and h.at < p_to and not h.ok
  union all
  select 's' || r.id, coalesce(r.finished_at, r.started_at), 'twf-sync',
         case r.status when 'error' then 'error' when 'running' then 'warn' else 'info' end,
         'sync', r.script,
         'TWF sync ' || r.status || '  ' || coalesce(r.message, '') ||
           coalesce('  ' || r.rows_written || ' rows', '')
  from sync_runs r where coalesce(r.finished_at, r.started_at) >= p_from and coalesce(r.finished_at, r.started_at) < p_to
  union all
  select 'c' || d.runid, d.start_time, 'cron', 'error', 'cron', j.jobname,
         'Job ' || j.jobname || ' failed  ' || left(coalesce(d.return_message, ''), 300)
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
  where d.runid > (select max(runid) - 30000 from cron.job_run_details)
    and d.status = 'failed' and d.start_time >= p_from and d.start_time < p_to
  union all
  select 'x' || x.id, x.opened_at, 'alerts', case x.severity when 'critical' then 'error' else 'warn' end,
         'alert', x.kind, 'Alert opened  ' || x.title || '  ' || coalesce(x.detail, '')
  from system_alerts x where x.opened_at >= p_from and x.opened_at < p_to
  union all
  select 'r' || x.id, x.resolved_at, 'alerts', 'info', 'alert', x.kind, 'Alert resolved  ' || x.title
  from system_alerts x where x.resolved_at >= p_from and x.resolved_at < p_to
$$;
revoke execute on function public.system_log_rows(timestamptz, timestamptz) from public, anon, authenticated;

-- ── Stream: newest first, filtered, paged ──
create or replace function public.system_logs(
  p_from timestamptz, p_to timestamptz default now(), p_sources text[] default null,
  p_levels text[] default null, p_q text default null, p_limit int default 200, p_before timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.ts desc, t.id desc), '[]') into r from (
    select * from system_log_rows(p_from, coalesce(p_before, p_to)) l
    where (p_sources is null or l.source = any(p_sources))
      and (p_levels is null or l.level = any(p_levels))
      and (p_q is null or p_q = '' or l.message ilike '%' || p_q || '%' or l.fn ilike '%' || p_q || '%' or l.source ilike '%' || p_q || '%')
    order by l.ts desc, l.id desc
    limit greatest(1, least(coalesce(p_limit, 200), 1000))) t;
  return r;
end $$;

-- ── Histogram + source counts for the same filter ──
create or replace function public.system_log_histogram(
  p_from timestamptz, p_to timestamptz default now(), p_sources text[] default null,
  p_levels text[] default null, p_q text default null, p_buckets int default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  step interval := (p_to - p_from) / greatest(10, least(coalesce(p_buckets, 60), 200));
  r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  with base as (
    select * from system_log_rows(p_from, p_to) l
    where (p_q is null or p_q = '' or l.message ilike '%' || p_q || '%' or l.fn ilike '%' || p_q || '%' or l.source ilike '%' || p_q || '%')),
  f as (
    select * from base
    where (p_sources is null or source = any(p_sources)) and (p_levels is null or level = any(p_levels))),
  b as (
    select g as t0,
           count(f.id) filter (where f.level = 'info')  as info,
           count(f.id) filter (where f.level = 'warn')  as warn,
           count(f.id) filter (where f.level = 'error') as error
    from generate_series(p_from, p_to - step, step) g
    left join f on f.ts >= g and f.ts < g + step
    group by g)
  select jsonb_build_object(
    'step_seconds', extract(epoch from step)::int,
    'buckets', (select coalesce(jsonb_agg(jsonb_build_object('t', t0, 'info', info, 'warn', warn, 'error', error) order by t0), '[]') from b),
    'total', (select count(*) from f),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'n', n, 'err', err) order by n desc), '[]')
                from (select source, count(*) n, count(*) filter (where level = 'error') err from base
                      where (p_levels is null or level = any(p_levels)) group by source) s)
  ) into r;
  return r;
end $$;

-- ── Row detail for the expanded log line ──
create or replace function public.system_log_detail(p_id text)
returns jsonb language plpgsql stable security definer set search_path = public, cron as $$
declare k text := left(p_id, 1); n bigint := nullif(substr(p_id, 2), '')::bigint; r jsonb;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if k = 'a' then select to_jsonb(t) into r from api_calls t where t.id = n;
  elsif k = 'h' then select to_jsonb(t) into r from api_health_checks t where t.id = n;
  elsif k = 's' then select to_jsonb(t) into r from sync_runs t where t.id = n;
  elsif k = 'c' then select to_jsonb(t) || jsonb_build_object('job', j.jobname, 'schedule', j.schedule)
                     into r from cron.job_run_details t join cron.job j on j.jobid = t.jobid where t.runid = n;
  elsif k in ('x', 'r') then select to_jsonb(t) into r from system_alerts t where t.id = n;
  end if;
  return r;
end $$;

-- ── Daily uptime per provider for the monitor bars ──
create or replace function public.system_uptime(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; d int := greatest(1, least(coalesce(p_days, 30), 90));
  today date := (now() at time zone 'Pacific/Auckland')::date;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  with days as (
    select (today - g)::date as day from generate_series(d - 1, 0, -1) g),
  agg as (
    select provider, (at at time zone 'Pacific/Auckland')::date as day,
           count(*) n, count(*) filter (where ok) ok
    from api_health_checks where at > now() - make_interval(days => d + 1) group by 1, 2)
  select jsonb_object_agg(p.code, (
    select jsonb_agg(jsonb_build_object('d', dd.day, 'n', coalesce(a.n, 0), 'ok', coalesce(a.ok, 0)) order by dd.day)
    from days dd left join agg a on a.provider = p.code and a.day = dd.day)) into r
  from api_providers p where p.active;
  return coalesce(r, '{}'::jsonb);
end $$;

revoke execute on function public.system_alert_settings_save(boolean, text[], int, boolean), public.system_alerts_list(int),
  public.system_logs(timestamptz, timestamptz, text[], text[], text, int, timestamptz),
  public.system_log_histogram(timestamptz, timestamptz, text[], text[], text, int),
  public.system_log_detail(text), public.system_uptime(int) from public, anon;
grant execute on function public.system_alert_settings_save(boolean, text[], int, boolean), public.system_alerts_list(int),
  public.system_logs(timestamptz, timestamptz, text[], text[], text, int, timestamptz),
  public.system_log_histogram(timestamptz, timestamptz, text[], text[], text, int),
  public.system_log_detail(text), public.system_uptime(int) to authenticated;

notify pgrst, 'reload schema';

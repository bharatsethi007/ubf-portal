-- REPO PARITY ONLY. Already applied live 5 Oct 2026. Do not re-run.
-- Archive-to-S3: db-archive edge fn (service_role) fetches old rows, writes gzip JSONL
-- to S3 archive/<source>/<date>/, verifies, then deletes. Latest row per vessel/vehicle kept.
-- Sources: cron_runs (>7d), vessel_positions (>30d), vehicle_positions (>30d).

create or replace function public.archive_fetch(p_source text, p_limit int default 5000)
returns jsonb language plpgsql security definer set search_path = public, cron as $$
declare r jsonb;
begin
  if p_source = 'cron_runs' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.runid), '[]') into r from (
      select * from cron.job_run_details where start_time < now() - interval '7 days' order by runid limit p_limit) t;
  elsif p_source = 'vessel_positions' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') into r from (
      select v.* from vessel_positions v
      where v.received_at < now() - interval '30 days'
        and v.id not in (select id from vessel_positions_latest)
      order by v.id limit p_limit) t;
  elsif p_source = 'vehicle_positions' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') into r from (
      select d.* from dispatch_vehicle_positions d
      where d.received_at < now() - interval '30 days'
        and d.id not in (select distinct on (tn_vehicle_id) id from dispatch_vehicle_positions order by tn_vehicle_id, position_timestamp desc)
      order by d.id limit p_limit) t;
  else
    raise exception 'unknown source %', p_source;
  end if;
  return r;
end $$;

create or replace function public.archive_delete(p_source text, p_ids bigint[])
returns int language plpgsql security definer set search_path = public, cron as $$
declare n int;
begin
  if p_source = 'cron_runs' then delete from cron.job_run_details where runid = any(p_ids);
  elsif p_source = 'vessel_positions' then delete from vessel_positions where id = any(p_ids);
  elsif p_source = 'vehicle_positions' then delete from dispatch_vehicle_positions where id = any(p_ids);
  else raise exception 'unknown source %', p_source;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.archive_fetch(text, int) from public, anon, authenticated;
revoke all on function public.archive_delete(text, bigint[]) from public, anon, authenticated;
grant execute on function public.archive_fetch(text, int) to service_role;
grant execute on function public.archive_delete(text, bigint[]) to service_role;

select cron.unschedule('db-archive-nightly') where exists (select 1 from cron.job where jobname = 'db-archive-nightly');
select cron.schedule(
  'db-archive-nightly',
  '13 14 * * *',
  $c$select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/db-archive',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body := '{"maxBatches":20}'::jsonb,
      timeout_milliseconds := 300000);$c$
);

notify pgrst, 'reload schema';

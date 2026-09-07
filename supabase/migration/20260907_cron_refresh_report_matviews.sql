-- 20260907_cron_refresh_report_matviews.sql
-- do not re-run, applied via MCP
select cron.unschedule('refresh-report-matviews')
where exists (select 1 from cron.job where jobname = 'refresh-report-matviews');

select cron.schedule(
  'refresh-report-matviews',
  '*/15 * * * *',
  $$refresh materialized view concurrently public.mv_consol_teu; refresh materialized view concurrently reporting.mv_job_financials;$$
);

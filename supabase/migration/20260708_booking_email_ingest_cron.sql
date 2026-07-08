-- Schedule booking-email-ingest every 5 minutes (pg_cron + pg_net).
-- Requires vault secrets: project_url, service_role_key (see comment block below).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- One-time vault setup (run manually if secrets are not already present):
-- select vault.create_secret('https://cpnkudbdzgnzmodhsrbf.supabase.co', 'project_url');
-- select vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'service_role_key');

do $cron$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'booking-email-ingest';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'booking-email-ingest',
    '*/5 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/booking-email-ingest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
    $job$
  );
end;
$cron$;

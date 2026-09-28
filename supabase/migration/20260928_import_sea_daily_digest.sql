-- APPLIED LIVE via Supabase MCP on 2026-09-28 (migration: import_sea_daily_digest). Repo parity only, do not re-run.
-- Import Sea daily digest: subscriptions, send log, row source, 7am NZ cron.
create table if not exists public.import_sea_digest_subscriptions (
  user_id uuid primary key references public.staff_users(user_id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.import_sea_digest_subscriptions enable row level security;
drop policy if exists digest_sub_own_select on public.import_sea_digest_subscriptions;
drop policy if exists digest_sub_own_insert on public.import_sea_digest_subscriptions;
drop policy if exists digest_sub_own_delete on public.import_sea_digest_subscriptions;
create policy digest_sub_own_select on public.import_sea_digest_subscriptions
  for select to authenticated using (user_id = auth.uid() and public.is_staff());
create policy digest_sub_own_insert on public.import_sea_digest_subscriptions
  for insert to authenticated with check (user_id = auth.uid() and public.is_staff());
create policy digest_sub_own_delete on public.import_sea_digest_subscriptions
  for delete to authenticated using (user_id = auth.uid() and public.is_staff());

create table if not exists public.import_sea_digest_log (
  nz_date date primary key,
  sent_at timestamptz not null default now(),
  recipients int not null default 0
);
alter table public.import_sea_digest_log enable row level security;

-- One row per container per section. Service role only.
create or replace function public.import_sea_digest_rows(p_today date default (now() at time zone 'Pacific/Auckland')::date)
returns table(section text, job_no text, importer text, container_no text, shipping_line text,
              eta date, last_free_day date, return_depot text)
language sql stable security definer set search_path = public as $$
  with base as (
    select b.job_no,
      coalesce(imp.name, cust.name) as importer,
      bc.container_no,
      coalesce(nullif(trim(ct.operator_name), ''), b.m_shipping_line, sl.name) as shipping_line,
      coalesce(ct.inbound_eta::date, s.eta, b.m_eta) as eta,
      coalesce((ct.last_free_at at time zone 'Pacific/Auckland')::date, b.last_free_day) as lfd,
      coalesce(ct.empty_return_depot_name, ct.empty_return_depot) as depot,
      coalesce(ct.discharged_at::date, b.discharge_date) as discharged,
      coalesce(ct.gate_out_at::date, ct.delivered_at::date, b.delivery_date) as delivered,
      b.container_return_date as returned
    from public.bookings b
    left join public.booking_containers bc on bc.booking_id = b.id
    left join public.container_tracking ct on ct.booking_id = b.id and upper(ct.container_no) = upper(bc.container_no)
    left join public.shipments s on s.job_unique = b.shipment_id
    left join public.customers cust on cust.account_id = b.account_id
    left join public.customers imp on imp.account_id = b.importer_account_id
    left join public.shipping_lines sl on upper(sl.code) = upper(b.shipping_line_code)
    where b.mode = 'sea_import' and b.archived_at is null
  )
  select 'empty_return', job_no, importer, container_no, shipping_line, eta, lfd, depot
    from base where delivered is not null and returned is null
  union all
  select 'at_port', job_no, importer, container_no, shipping_line, eta, lfd, depot
    from base where discharged is not null and delivered is null
  union all
  select 'arriving', job_no, importer, container_no, shipping_line, eta, lfd, depot
    from base where discharged is null and eta between p_today and p_today + 7
  order by 1, 7 nulls last, 6 nulls last, 2;
$$;
revoke all on function public.import_sea_digest_rows(date) from public, anon, authenticated;
grant execute on function public.import_sea_digest_rows(date) to service_role;

-- 7am Auckland: fire at 18:00 and 19:00 UTC, function keeps only NZ hour 7 (DST-safe).
do $$ begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('import-sea-digest-a','import-sea-digest-b');
end $$;
select cron.schedule('import-sea-digest-a', '0 18 * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/import-sea-daily-digest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb);
$c$);
select cron.schedule('import-sea-digest-b', '0 19 * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/import-sea-daily-digest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb);
$c$);

notify pgrst, 'reload schema';

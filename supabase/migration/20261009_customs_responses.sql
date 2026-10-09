-- TSW import entry responses (CF CUSTOMS_MSGS_RES1, TSW_TYPE IM1) + clearance numbers on entries.
-- Idempotent. Safe to re-run.

create table if not exists public.customs_responses (
  job_unique    bigint not null,
  tsw_type      text   not null,
  line          integer not null,
  received_at   timestamptz not null,
  agency        text,          -- NZCS / MPIBIO / MPIFOOD / TSW
  status        text,          -- 819, B04, F05 ...
  note          text,
  entry_number  text,          -- Declaration ID
  sender_ref    text,
  release_at    timestamptz,
  statement     text,
  duty_total    numeric,
  attachments   jsonb,         -- [{category, filename, uri}]
  synced_at     timestamptz not null default now(),
  primary key (job_unique, tsw_type, line, received_at)
);
create index if not exists customs_responses_job_idx on public.customs_responses (job_unique, received_at);

alter table public.customs_entries
  add column if not exists entry_number        text,
  add column if not exists customs_released_at timestamptz,
  add column if not exists mpi_bio_cleared_at  timestamptz,
  add column if not exists mpi_food_cleared_at timestamptz,
  add column if not exists bacc_number         text,
  add column if not exists facc_number         text,
  add column if not exists duty_total          numeric,
  add column if not exists clearance_docs      jsonb;

alter table public.customs_responses enable row level security;
drop policy if exists staff_read_customs_responses on public.customs_responses;
create policy staff_read_customs_responses on public.customs_responses for select to authenticated using (is_staff());
revoke all on public.customs_responses from anon, authenticated;
grant select on public.customs_responses to authenticated;

-- Views: recreate so they carry the new entry columns
drop view if exists public.v_booking_customs;
drop view if exists public.v_customs_entries;

create view public.v_customs_entries with (security_invoker = true) as
select e.*,
       cs.name as customs_status_label,
       ms.name as mpi_status_label,
       fs.name as mpi_food_status_label,
       c.name  as customer_name,
       case when e.linked_module is null then 'customs_only' else 'with_freight' end as job_kind
from public.customs_entries e
left join public.customs_status_codes cs on cs.code = e.customs_status
left join public.customs_status_codes ms on ms.code = e.mpi_status
left join public.customs_status_codes fs on fs.code = e.mpi_food_status
left join public.customers c on c.account_id = e.account_id;

create view public.v_booking_customs with (security_invoker = true) as
select b.id as booking_id, e.id as entry_id, e.job_unique, e.job_kind,
       e.customs_status, e.customs_status_label,
       e.mpi_status, e.mpi_status_label,
       e.mpi_food_status, e.mpi_food_status_label,
       e.clear_date, e.closed, e.eta, e.modified_src,
       e.entry_number, e.customs_released_at, e.mpi_bio_cleared_at, e.mpi_food_cleared_at,
       e.bacc_number, e.facc_number, e.duty_total, e.clearance_docs
from public.bookings b
join public.v_customs_entries e on e.job_unique = b.shipment_id;

revoke all on public.v_booking_customs, public.v_customs_entries from anon, authenticated;
grant select on public.v_booking_customs, public.v_customs_entries to authenticated;

notify pgrst, 'reload schema';

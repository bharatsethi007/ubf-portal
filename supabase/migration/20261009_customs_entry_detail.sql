-- Extra customs entry detail for the Clearance Advice PDF. Idempotent. Safe to re-run.
alter table public.customs_entries
  add column if not exists goods_desc      text,
  add column if not exists packages        numeric,
  add column if not exists pack_desc       text,
  add column if not exists gross_kg        numeric,
  add column if not exists cubic_m3        numeric,
  add column if not exists supplier        text,
  add column if not exists payment_method  text,
  add column if not exists depot           text,
  add column if not exists atf_code        text,
  add column if not exists marks           text,
  add column if not exists duty_breakdown  jsonb;   -- {TypeCode: amount} from latest NZ Customs response

alter table public.customs_responses
  add column if not exists duty_breakdown  jsonb;

-- Recreate views so they carry the new columns
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

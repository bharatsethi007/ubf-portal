-- Shipments: load_type, customer_ref, consignee_name
-- Draft — not yet applied to remote (confirmed via information_schema 2026-07-03).
-- Apply before running patched sync_to_supabase.py.

alter table public.shipments
  add column if not exists load_type text;

alter table public.shipments
  drop constraint if exists shipments_load_type_check;

alter table public.shipments
  add constraint shipments_load_type_check
  check (load_type is null or load_type in ('LCL', 'FCL'));

comment on column public.shipments.load_type is
  'Sea load type from FIS_JOB.FCL / FES_JOB.FCL. Y→FCL, N→LCL.';

alter table public.shipments
  add column if not exists customer_ref text;

comment on column public.shipments.customer_ref is
  'Customer reference: FRT_REFERENCE.REFERENCE (job join) or FES_JOB.BOOKING_REF.';

alter table public.shipments
  add column if not exists consignee_name text;

comment on column public.shipments.consignee_name is
  'Consignee party name from {module}_JOB.CONS_NAME1 (not CONSIGNEE account code).';

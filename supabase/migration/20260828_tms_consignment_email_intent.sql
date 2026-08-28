-- Email-intent flags for TMS consignment creation.
-- Pickup: email Labels / Consignment Note PDFs to sender.
-- Drop-off: email POD to receiver contact (+ existing receiver_additional_emails).
-- APPLIED LIVE via MCP apply_migration on 2026-08-28 — repo-parity only, do not re-run.

alter table public.tms_consignments
  add column if not exists email_labels boolean not null default false,
  add column if not exists email_consignment_note boolean not null default false,
  add column if not exists email_pod boolean not null default false;

comment on column public.tms_consignments.email_labels is 'Pickup: email Labels PDF to sender';
comment on column public.tms_consignments.email_consignment_note is 'Pickup: email Consignment Note PDF to sender';
comment on column public.tms_consignments.email_pod is 'Drop-off: email POD to receiver contact (+ receiver_additional_emails)';

notify pgrst, 'reload schema';

-- POD signature capture fields (populated by the driver app when it ships).
-- APPLIED LIVE via MCP on 2026-08-28 — repo-parity only, do not re-run.
alter table public.tms_consignments
  add column if not exists pod_received_by text,
  add column if not exists pod_signature_url text,
  add column if not exists pod_signed_at timestamptz;

comment on column public.tms_consignments.pod_received_by is 'POD: name of person who received/signed (captured by driver app)';
comment on column public.tms_consignments.pod_signature_url is 'POD: captured signature image (URL or data URL) from driver app';
comment on column public.tms_consignments.pod_signed_at is 'POD: timestamp the signature was captured (driver app)';

notify pgrst, 'reload schema';

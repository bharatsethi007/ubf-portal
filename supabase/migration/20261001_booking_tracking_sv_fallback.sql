-- Maersk -> SeaVantage fallback flag (applied live via MCP 1 Oct 2026).
alter table public.booking_tracking
  add column if not exists carrier_fallback_sv boolean not null default false,
  add column if not exists carrier_fallback_at timestamptz,
  add column if not exists carrier_fallback_reason text;

comment on column public.booking_tracking.carrier_fallback_sv is
  'True when Maersk API returned no events for every container; SeaVantage then owns tracking for this booking. Staff can reset to false to retry Maersk.';

update public.sv_carrier_map
  set notes = 'Maersk group - free Maersk API first; SeaVantage (MAEU) only when booking_tracking.carrier_fallback_sv = true'
  where line_code = 'MAERSK';

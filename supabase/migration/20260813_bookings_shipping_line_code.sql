-- Portal-picked shipping line on the booking (system of record; set before the ERP job exists).
-- Stores a shipping_lines.code; drives SeaVantage routing + carrier code. No hard FK so the
-- line list can grow without blocking inserts; the picker constrains values.
alter table public.bookings
  add column if not exists shipping_line_code text;
comment on column public.bookings.shipping_line_code is
  'Portal-picked carrier (shipping_lines.code). Resolves to sv_carrier_map for SeaVantage routing/code.';

notify pgrst, 'reload schema';

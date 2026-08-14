-- Master B/L on the booking (portal-entered now; auto-fill from shipments.master_bill once
-- a booking is ERP-linked). SeaVantage prefers MBL -- one lookup covers all containers on the B/L.
alter table public.bookings
  add column if not exists mbl_no text;
comment on column public.bookings.mbl_no is
  'Master B/L number. Preferred SeaVantage tracking key (covers all containers on the B/L).';

alter table public.booking_tracking
  add column if not exists seavantage_mbl_document_id text,
  add column if not exists seavantage_mbl_registered_at timestamptz;

notify pgrst, 'reload schema';

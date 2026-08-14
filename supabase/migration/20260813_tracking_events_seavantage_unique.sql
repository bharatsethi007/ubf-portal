-- Dedupe SeaVantage events, mirroring tracking_events_carrier_unique (partial to source).
create unique index if not exists tracking_events_seavantage_unique
  on public.tracking_events (booking_id, carrier_event_id)
  where source = 'seavantage' and carrier_event_id is not null;

notify pgrst, 'reload schema';

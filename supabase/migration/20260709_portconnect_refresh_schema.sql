-- PortConnect refresh: field overrides, hazards, estimated events, sync log booking_id
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS field_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.container_tracking
  ADD COLUMN IF NOT EXISTS hazard_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.tracking_events
  ADD COLUMN IF NOT EXISTS is_estimated boolean NOT NULL DEFAULT false;

ALTER TABLE public.portconnect_sync_log
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS portconnect_sync_log_booking_id_ran_at_idx
  ON public.portconnect_sync_log (booking_id, ran_at DESC);

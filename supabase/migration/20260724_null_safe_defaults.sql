-- Backfill nullable jsonb/object columns on pre-migration rows
UPDATE public.bookings
SET field_overrides = '{}'::jsonb
WHERE field_overrides IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN field_overrides SET DEFAULT '{}'::jsonb;

ALTER TABLE public.bookings
  ALTER COLUMN field_overrides SET NOT NULL;

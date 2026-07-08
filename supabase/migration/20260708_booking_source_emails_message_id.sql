-- Graph message dedup + poison-message ceiling for booking-email-ingest.

alter table public.booking_source_emails
  add column if not exists message_id text,
  add column if not exists attempt_count integer not null default 0;

comment on column public.booking_source_emails.message_id is
  'Microsoft Graph message id — prevents reprocessing the same inbound email.';
comment on column public.booking_source_emails.attempt_count is
  'Processing attempts; marked failed after 3.';

create unique index if not exists uq_booking_source_emails_message_id
  on public.booking_source_emails (message_id)
  where message_id is not null;

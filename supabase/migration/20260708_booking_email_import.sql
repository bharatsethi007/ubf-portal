-- Email-to-booking draft schema (project cpnkudbdzgnzmodhsrbf).
-- Applied via Supabase MCP apply_migration (booking_email_import).

-- ── bookings: email-import draft support ─────────────────────────────
-- source already allows manual | email_parsed | customer_portal; add email_import.
-- status already includes draft (among submitted, new, parsed, …).

alter table public.bookings
  add column if not exists owner_email text,
  add column if not exists extraction_confidence jsonb;

comment on column public.bookings.owner_email is
  'Staff member who forwarded the source email (booking owner).';
comment on column public.bookings.extraction_confidence is
  'Per-field confidence/uncertainty flags from the email extractor.';

alter table public.bookings drop constraint if exists bookings_source_check;
alter table public.bookings add constraint bookings_source_check
  check (source = any (array[
    'manual'::text,
    'email_parsed'::text,
    'email_import'::text,
    'customer_portal'::text
  ]));

-- ── booking_source_emails ────────────────────────────────────────────
create table if not exists public.booking_source_emails (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid references public.bookings(id) on delete set null,
  from_address      text,
  forwarded_by      text,
  subject           text,
  received_at       timestamptz,
  raw_body          text,
  attachment_paths  text[],
  processing_status text not null default 'pending',
  error_detail      text,
  created_at        timestamptz not null default now(),

  constraint booking_source_emails_processing_status_check
    check (processing_status = any (array[
      'pending'::text,
      'extracted'::text,
      'failed'::text,
      'needs_review'::text
    ]))
);

comment on table public.booking_source_emails is
  'Inbound email payloads for booking draft extraction (may exist before a booking row).';

create index if not exists ix_booking_source_emails_booking
  on public.booking_source_emails (booking_id)
  where booking_id is not null;

create index if not exists ix_booking_source_emails_status
  on public.booking_source_emails (processing_status, received_at desc nulls last);

-- ── RLS (staff-scoped, same pattern as bookings / SLI) ───────────────
alter table public.booking_source_emails enable row level security;

drop policy if exists booking_source_emails_staff on public.booking_source_emails;
create policy booking_source_emails_staff on public.booking_source_emails
  for all to authenticated
  using     (is_staff())
  with check(is_staff());

-- ── Storage: raw email bodies + attachments ──────────────────────────
insert into storage.buckets (id, name, public)
values ('booking-emails', 'booking-emails', false)
on conflict (id) do nothing;

-- Staff app: full object access in bucket (read/upload/manage).
drop policy if exists staff_booking_emails_all on storage.objects;
create policy staff_booking_emails_all on storage.objects
  for all to authenticated
  using     (bucket_id = 'booking-emails' and is_staff())
  with check(bucket_id = 'booking-emails' and is_staff());

-- Ingestion Edge Functions use service_role (bypasses RLS) for automated writes.

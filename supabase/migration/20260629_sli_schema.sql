-- 20260629_sli_schema.sql
-- SLI (Shipper's Letter of Instruction) — per-supplier tokenised documents.
-- Project cpnkudbdzgnzmodhsrbf. Apply via Supabase MCP apply_migration.
--
-- Model: one SLI per supplier.
--   consolidation -> one row per booking_suppliers row (booking_supplier_id set)
--   single shipper -> one row, booking_supplier_id null, supplier = booking.account_id
-- Customer page reaches data ONLY through token-validated Edge Functions (service role).
-- No anon/public table access. Staff access via staff_users.

-- ── enums ──────────────────────────────────────────────────────────
do $$ begin
  create type sli_status as enum
    ('draft','sent','viewed','endorsed','changes_requested','expired');
exception when duplicate_object then null; end $$;

-- ── sli_documents ──────────────────────────────────────────────────
create table if not exists public.sli_documents (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  booking_supplier_id uuid references public.booking_suppliers(id) on delete cascade, -- null = single shipper
  supplier_account_id text,

  token               text not null unique default encode(gen_random_bytes(24),'hex'),
  status              sli_status not null default 'draft',

  -- staff-set, read-only to the customer (origin, dest, flight, hawb, airline, consignee, shipment type)
  staff_fields    jsonb not null default '{}'::jsonb,
  -- snapshot of the supplier's editable fields at send time
  prefilled       jsonb not null default '{}'::jsonb,
  -- customer's proposed changes (NOT yet written to booking — ops accepts via gate)
  customer_edits  jsonb not null default '{}'::jsonb,
  -- SLI-only required answers (paying?, insurance, DG, batteries, country of origin,
  -- drawback, purpose, CAA auth, notify party, special instructions)
  sli_answers     jsonb not null default '{}'::jsonb,

  -- declaration
  signed_name     text,
  signature       text,            -- typed name or base64 drawn signature
  signed_at       timestamptz,

  -- output + lifecycle
  pdf_path        text,            -- sli-uploads bucket path of generated PDF
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  sent_at         timestamptz,
  viewed_at       timestamptz,
  endorsed_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '14 days'),

  -- ops acceptance gate (edits-as-proposals)
  edits_accepted_at timestamptz,
  edits_accepted_by uuid references auth.users(id)
);

-- one ACTIVE sli per supplier-per-booking (regenerate replaces). Active = not expired/superseded.
-- partial unique: a booking_supplier_id can have at most one non-expired row.
create unique index if not exists uq_sli_active_per_supplier
  on public.sli_documents (booking_id, booking_supplier_id)
  where status <> 'expired';
-- single-shipper variant (booking_supplier_id is null) — one active per booking
create unique index if not exists uq_sli_active_single_shipper
  on public.sli_documents (booking_id)
  where booking_supplier_id is null and status <> 'expired';

create index if not exists ix_sli_booking on public.sli_documents (booking_id);
create index if not exists ix_sli_token   on public.sli_documents (token);

-- ── sli_attachments ────────────────────────────────────────────────
create table if not exists public.sli_attachments (
  id           uuid primary key default gen_random_uuid(),
  sli_id       uuid not null references public.sli_documents(id) on delete cascade,
  doc_type     text not null,   -- commercial_invoice | packing_list | dg_cert | cert_origin
                                 -- | export_permit | letter_of_credit | other
  file_name    text not null,
  storage_path text not null,   -- path within sli-uploads bucket
  uploaded_at  timestamptz not null default now()
);
create index if not exists ix_sli_att_sli on public.sli_attachments (sli_id);

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.sli_documents   enable row level security;
alter table public.sli_attachments enable row level security;

-- staff only (portal customers never touch these tables directly; the public
-- customer page goes through Edge Functions using the service role).
drop policy if exists sli_documents_staff on public.sli_documents;
create policy sli_documents_staff on public.sli_documents
  for all to authenticated
  using     (exists (select 1 from staff_users where user_id = auth.uid()))
  with check(exists (select 1 from staff_users where user_id = auth.uid()));

drop policy if exists sli_attachments_staff on public.sli_attachments;
create policy sli_attachments_staff on public.sli_attachments
  for all to authenticated
  using     (exists (select 1 from staff_users where user_id = auth.uid()))
  with check(exists (select 1 from staff_users where user_id = auth.uid()));

-- ── private storage bucket for SLI uploads + generated PDFs ─────────
insert into storage.buckets (id, name, public)
values ('sli-uploads','sli-uploads', false)
on conflict (id) do nothing;

-- no public storage policies: all object access is via signed URLs minted by
-- the Edge Functions (service role). Staff app can also read via service role.

-- WhatsApp number-binding verification: OTP challenge store (audit + rate limiting).
-- Codes are stored hashed. Only service-role (verify Edge Functions) touch this; staff can read for support.
-- Applied live 2026-08-17.

create table if not exists public.whatsapp_verifications (
  id             uuid primary key default gen_random_uuid(),
  wa_id          text not null,
  account_id     text references public.customers(account_id) on delete cascade,
  portal_user_id uuid references public.portal_users(user_id) on delete set null,
  code_hash      text not null,                 -- sha256(code : wa_id : pepper)
  expires_at     timestamptz not null,
  attempts       integer not null default 0,
  max_attempts   integer not null default 5,
  consumed_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists whatsapp_verifications_wa_idx on public.whatsapp_verifications(wa_id, created_at desc);
create index if not exists whatsapp_verifications_account_idx on public.whatsapp_verifications(account_id);

alter table public.whatsapp_verifications enable row level security;
drop policy if exists staff_read_whatsapp_verifications on public.whatsapp_verifications;
create policy staff_read_whatsapp_verifications on public.whatsapp_verifications
  for select using (public.is_staff());
grant select on public.whatsapp_verifications to authenticated;

alter table public.whatsapp_contacts add column if not exists verified_at timestamptz;

notify pgrst, 'reload schema';

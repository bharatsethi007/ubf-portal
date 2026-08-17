-- WhatsApp channel: shared infra for inbound (quote/booking → ops gate) + outbound (tracking/milestones).
-- All staff-only RLS via is_staff(); Edge Functions use service_role (bypasses RLS).
-- Applied live 2026-08-17.

create table if not exists public.whatsapp_contacts (
  id             uuid primary key default gen_random_uuid(),
  wa_id          text not null unique,
  account_id     text references public.customers(account_id) on delete set null,
  portal_user_id uuid references public.portal_users(user_id) on delete set null,
  display_name   text,
  opted_in       boolean not null default false,
  opted_in_at    timestamptz,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists whatsapp_contacts_account_idx on public.whatsapp_contacts(account_id);

create table if not exists public.whatsapp_messages (
  id                 uuid primary key default gen_random_uuid(),
  wa_message_id      text unique,
  contact_id         uuid not null references public.whatsapp_contacts(id) on delete cascade,
  direction          text not null check (direction in ('inbound','outbound')),
  msg_type           text,
  body               text,
  media_path         text,
  template_name      text,
  intent             text,
  related_booking_id uuid references public.bookings(id) on delete set null,
  status             text not null default 'received',
  attempt_count      integer not null default 0,
  error_detail       text,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists whatsapp_messages_contact_idx on public.whatsapp_messages(contact_id, created_at desc);
create index if not exists whatsapp_messages_booking_idx on public.whatsapp_messages(related_booking_id);
create index if not exists whatsapp_messages_intent_idx  on public.whatsapp_messages(intent, status);

create table if not exists public.whatsapp_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  category    text not null default 'utility',
  language    text not null default 'en',
  purpose     text,
  body_params jsonb not null default '[]'::jsonb,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

alter table public.whatsapp_contacts  enable row level security;
alter table public.whatsapp_messages   enable row level security;
alter table public.whatsapp_templates  enable row level security;

drop policy if exists staff_all_whatsapp_contacts  on public.whatsapp_contacts;
drop policy if exists staff_all_whatsapp_messages   on public.whatsapp_messages;
drop policy if exists staff_all_whatsapp_templates  on public.whatsapp_templates;

create policy staff_all_whatsapp_contacts  on public.whatsapp_contacts  for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_whatsapp_messages   on public.whatsapp_messages   for all using (public.is_staff()) with check (public.is_staff());
create policy staff_all_whatsapp_templates  on public.whatsapp_templates  for all using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.whatsapp_contacts, public.whatsapp_messages, public.whatsapp_templates to authenticated;

create or replace function public.tg_whatsapp_messages_touch() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_whatsapp_messages_touch on public.whatsapp_messages;
create trigger trg_whatsapp_messages_touch before update on public.whatsapp_messages
  for each row execute function public.tg_whatsapp_messages_touch();

notify pgrst, 'reload schema';

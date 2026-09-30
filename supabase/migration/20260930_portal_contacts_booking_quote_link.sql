-- Portal contacts + booking parties + quote-to-booking link
-- (applied via Supabase MCP 30 Sep 2026 as several migrations; repo parity, do not re-run).
-- Live function bodies: portal_request_booking (v2), portal_booking_notify_payload, views portal_bookings / portal_quote_offers.
-- Pull them with: select pg_get_functiondef('public.portal_request_booking'::regproc);

create table if not exists public.portal_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id text not null default public.my_account_id() references public.customers(account_id) on delete cascade,
  role text not null default 'both' check (role in ('shipper','consignee','both')),
  company text not null,
  contact_name text, email text, phone text,
  address text, street text, city text, region text, postcode text, country text, country_code text,
  place_id text, lat double precision, lng double precision,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_contacts_account_idx on public.portal_contacts (account_id, lower(company));
alter table public.portal_contacts enable row level security;
drop policy if exists portal_contacts_own on public.portal_contacts;
create policy portal_contacts_own on public.portal_contacts for all to authenticated
  using (account_id = public.my_account_id()) with check (account_id = public.my_account_id());
drop policy if exists staff_all_portal_contacts on public.portal_contacts;
create policy staff_all_portal_contacts on public.portal_contacts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
revoke all on public.portal_contacts from anon;
grant select, insert, update, delete on public.portal_contacts to authenticated;
drop trigger if exists trg_portal_contacts_touch on public.portal_contacts;
create trigger trg_portal_contacts_touch before update on public.portal_contacts
  for each row execute function public.portal_touch_updated();

alter table public.bookings
  add column if not exists shipper_name text,
  add column if not exists shipper_contact text,
  add column if not exists shipper_postcode text,
  add column if not exists consignee_contact text,
  add column if not exists consignee_postcode text,
  add column if not exists pickup_address text,
  add column if not exists delivery_address text,
  add column if not exists needs_customs boolean,
  add column if not exists needs_insurance boolean,
  add column if not exists cargo_value numeric,
  add column if not exists cargo_value_currency text,
  add column if not exists hs_code text,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists quote_response_id uuid references public.quote_responses(id) on delete set null;
create index if not exists bookings_quote_idx on public.bookings (quote_id);
alter table public.quotes add column if not exists booking_id uuid references public.bookings(id) on delete set null;

notify pgrst, 'reload schema';

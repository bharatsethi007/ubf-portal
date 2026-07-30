-- 20260731_saved_parties.sql  (already applied to production)
create table if not exists public.saved_parties (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('shipper','consignee')),
  name text not null, contact text, phone text, email text,
  address text, city text, state text, postcode text, country text,
  account_id text, created_by uuid default auth.uid(),
  created_at timestamptz not null default now());
create index if not exists saved_parties_kind_name_idx on public.saved_parties (kind, lower(name));
alter table public.saved_parties enable row level security;
create policy saved_parties_staff_all on public.saved_parties for all using (is_staff()) with check (is_staff());

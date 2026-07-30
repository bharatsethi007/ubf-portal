-- 20260731_setup_charge_codes.sql  (already applied to production)
create table if not exists public.charge_groups (
  code text primary key, label text not null,
  sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now());
create table if not exists public.charge_codes (
  code text primary key, description text not null,
  charge_group text not null references public.charge_groups(code),
  sort_order integer not null default 0, active boolean not null default true,
  created_at timestamptz not null default now());
create index if not exists charge_codes_group_idx on public.charge_codes(charge_group);
insert into public.charge_groups (code,label,sort_order) values
  ('origin','Origin',10),('freight','Freight',20),('destination','Destination',30)
on conflict (code) do nothing;
insert into public.charge_codes (code,description,charge_group,sort_order) values
  ('OFR','Ocean Freight','freight',10),('AFR','Air Freight','freight',20),
  ('BAF','Bunker Adjustment Factor','freight',30),('OTHC','Origin Terminal Handling','origin',10),
  ('DOC','Documentation Fee','origin',20),('DTHC','Destination Terminal Handling','destination',10),
  ('CUS','Customs Clearance','destination',20),('DEL','Delivery / Cartage','destination',30)
on conflict (code) do nothing;
alter table public.charge_groups enable row level security;
alter table public.charge_codes enable row level security;
create policy charge_groups_staff_all on public.charge_groups for all using (is_staff()) with check (is_staff());
create policy charge_codes_staff_all on public.charge_codes for all using (is_staff()) with check (is_staff());
alter table public.quote_response_lines drop constraint if exists quote_response_lines_charge_group_check;
alter table public.quote_response_lines
  add constraint quote_response_lines_charge_group_fkey foreign key (charge_group) references public.charge_groups(code);
-- rollback: drop both tables; re-add CHECK (charge_group in ('origin','freight','destination'))

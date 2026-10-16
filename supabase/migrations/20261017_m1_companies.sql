-- M1 Multi-company foundation. CargoWise-style hierarchy:
--   company  = legal entity + own TradeWindow FDB + own finance (data wall): NZ, FJ, AU
--   branch   = office inside a company: AKL / SUV, LTK, NAN / SYD (ref prefix, address)
--   department = module (EA, ES, IA, IS) - already exists as bookings.module
-- Adds companies, branches, staff_companies, agent_company_codes, company_id on owned tables.
-- Backfills NZ / AKL. No RLS change, no UI change. Idempotent. Safe to re-run.
-- Finance schema NOT touched: fin_stage_commit uses positional select * and full reload
-- would wipe other companies. Handled in M3.
-- Legacy text columns customers.branch (ERP AKL/CHC) and staff_users.branch left as is.

begin;

-- 0. Remove earlier draft (m1_branches: branches = NZ/FJ/AU, offices, staff_branches).
-- Runs only if that old shape exists. Nothing used it yet.
do $$
declare r record;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'branches' and column_name = 'base_currency') then
    for r in select c.conrelid::regclass as tbl, c.conname
             from pg_constraint c
             where c.contype = 'f' and c.confrelid = 'public.branches'::regclass
               and c.conname like '%\_branch\_id\_fkey' escape '\' loop
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
      execute format('alter table %s drop column if exists branch_id', r.tbl);
    end loop;
    drop function if exists public.has_branch(text);
    drop function if exists public.my_branches();
    drop table if exists public.agent_branch_codes;
    drop table if exists public.staff_branches;
    drop table if exists public.offices;
    drop table if exists public.branches;
  end if;
end $$;

-- 1. companies --------------------------------------------------------------
create table if not exists public.companies (
  code           text primary key check (code ~ '^[A-Z]{2}$'),
  name           text not null,
  country_code   text not null,
  base_currency  text not null,
  timezone       text not null,
  fy_start_month int  check (fy_start_month between 1 and 12),
  erp_label      text,
  legal_name     text,
  tax_label      text,
  tax_number     text,
  logo_path      text,
  is_active      boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

insert into public.companies (code, name, country_code, base_currency, timezone, fy_start_month, erp_label, legal_name, tax_label, is_active, sort_order) values
  ('NZ', 'UBF New Zealand', 'NZ', 'NZD', 'Pacific/Auckland', 4,    'TradeWindow NZ (UBNZ.FDB)', 'UB Freight Ltd', 'GST', true,  1),
  ('FJ', 'UBF Fiji',        'FJ', 'FJD', 'Pacific/Fiji',     null, 'TradeWindow FJ', null, 'VAT', false, 2),
  ('AU', 'UBF Australia',   'AU', 'AUD', 'Australia/Sydney', 7,    'TradeWindow AU', null, 'GST', false, 3)
on conflict (code) do nothing;

alter table public.companies enable row level security;
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select to authenticated using (true);
drop policy if exists companies_admin on public.companies;
create policy companies_admin on public.companies for all to authenticated using (is_admin()) with check (is_admin());

-- 2. branches (offices inside a company) ------------------------------------
-- Branches share customers, ERP and finance within the company. Staff see whole company.
create table if not exists public.branches (
  code            text primary key check (code ~ '^[A-Z]{3}$'),
  company_id      text not null references public.companies(code),
  name            text not null,
  city            text,
  unlocode        text,
  erp_branch_code text,
  ref_prefix      text not null,
  address         text,
  phone           text,
  email           text,
  is_active       boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists branches_company_erp_code
  on public.branches (company_id, erp_branch_code) where erp_branch_code is not null;

insert into public.branches (code, company_id, name, city, unlocode, erp_branch_code, ref_prefix, is_active, sort_order) values
  ('AKL', 'NZ', 'Auckland', 'Auckland', 'NZAKL', 'AKL', 'AKL', true,  1),
  ('SUV', 'FJ', 'Suva',     'Suva',     'FJSUV', null,  'SUV', false, 1),
  ('LTK', 'FJ', 'Lautoka',  'Lautoka',  'FJLTK', null,  'LTK', false, 2),
  ('NAN', 'FJ', 'Nadi',     'Nadi',     'FJNAN', null,  'NAN', false, 3),
  ('SYD', 'AU', 'Sydney',   'Sydney',   'AUSYD', null,  'SYD', false, 1)
on conflict (code) do nothing;

alter table public.branches enable row level security;
drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select to authenticated using (true);
drop policy if exists branches_admin on public.branches;
create policy branches_admin on public.branches for all to authenticated using (is_admin()) with check (is_admin());

-- 3. staff_companies --------------------------------------------------------
create table if not exists public.staff_companies (
  user_id     uuid not null references public.staff_users(user_id) on delete cascade,
  company_id  text not null references public.companies(code),
  access      text not null default 'full' check (access in ('full','network_viewer')),
  is_default  boolean not null default false,
  home_branch text references public.branches(code),
  created_at  timestamptz not null default now(),
  primary key (user_id, company_id)
);
create unique index if not exists staff_companies_one_default
  on public.staff_companies (user_id) where is_default;

insert into public.staff_companies (user_id, company_id, access, is_default, home_branch)
select user_id, 'NZ', 'full', true, 'AKL' from public.staff_users
on conflict (user_id, company_id) do nothing;

alter table public.staff_companies enable row level security;
drop policy if exists staff_companies_read on public.staff_companies;
create policy staff_companies_read on public.staff_companies for select to authenticated
  using (user_id = auth.uid() or is_admin());
drop policy if exists staff_companies_admin on public.staff_companies;
create policy staff_companies_admin on public.staff_companies for all to authenticated
  using (is_admin()) with check (is_admin());

-- 4. agent_company_codes (agents stay shared, each FDB has own code) --------
create table if not exists public.agent_company_codes (
  agent_id   uuid not null references public.agents(id) on delete cascade,
  company_id text not null references public.companies(code),
  erp_code   text not null,
  created_at timestamptz not null default now(),
  primary key (agent_id, company_id),
  unique (company_id, erp_code)
);

insert into public.agent_company_codes (agent_id, company_id, erp_code)
select distinct on (upper(erp_account_code)) id, 'NZ', erp_account_code
from public.agents
where erp_account_code is not null and btrim(erp_account_code) <> ''
order by upper(erp_account_code), created_at
on conflict do nothing;

alter table public.agent_company_codes enable row level security;
drop policy if exists agent_company_codes_read on public.agent_company_codes;
create policy agent_company_codes_read on public.agent_company_codes for select to authenticated using (is_staff());
drop policy if exists agent_company_codes_admin on public.agent_company_codes;
create policy agent_company_codes_admin on public.agent_company_codes for all to authenticated
  using (is_admin()) with check (is_admin());

-- 5. Helpers (not wired into RLS until M2) ----------------------------------
create or replace function public.has_company(p_company text)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from staff_companies sc join staff_users su on su.user_id = sc.user_id
    where sc.user_id = auth.uid() and su.is_active and sc.company_id = p_company and sc.access = 'full');
$$;

create or replace function public.my_companies()
returns setof text language sql stable security definer set search_path = public as $$
  select code from companies where is_admin()
  union
  select sc.company_id from staff_companies sc join staff_users su on su.user_id = sc.user_id
  where sc.user_id = auth.uid() and su.is_active;
$$;

grant execute on function public.has_company(text) to authenticated;
grant execute on function public.my_companies() to authenticated;

commit;

-- 6. company_id on owned header tables --------------------------------------
-- Child rows (lines, containers, comments) inherit company from their parent.
-- Add column = metadata only (constant default). FK added NOT VALID then validated
-- (validate does not block writes). Default 'NZ' stays until M3 sync is company-aware.
do $$
declare
  t text;
  owned text[] := array[
    -- ERP synced
    'customers','contacts','shipments','shipment_legs','containers','invoices','job_charges',
    'customs_entries','customs_responses','misc_jobs','erp_job_references','erp_account_ref',
    -- Bookings / ops
    'bookings','booking_tasks','air_consols','consol_tracking','creditor_invoices','courier_shipments',
    'sli_documents','csat_requests','task_templates','customer_task_rules',
    -- Quotes / rates
    'quotes','rate_requests','rate_cards','rate_margin_rules','customer_rate_cards',
    'local_charge_sheets','air_local_charge_sheets','charge_templates','brainbox_rules',
    'cartage_zones','drop_off_depots',
    -- Inbox / portal
    'inbox_conversations','module_mailboxes','portal_threads',
    -- TMS / fleet
    'tms_consignments','tms_trips','tms_depots','tms_drivers','tms_vehicles',
    'dispatch_drivers','dispatch_vehicles'
  ];
begin
  foreach t in array owned loop
    continue when to_regclass('public.' || t) is null;
    execute format('alter table public.%I add column if not exists company_id text not null default %L', t, 'NZ');
    if not exists (select 1 from pg_constraint where conname = t || '_company_id_fkey'
                   and conrelid = ('public.' || t)::regclass) then
      execute format('alter table public.%I add constraint %I foreign key (company_id) references public.companies(code) not valid',
                     t, t || '_company_id_fkey');
    end if;
  end loop;
end $$;

do $$
declare r record;
begin
  for r in select conrelid::regclass as tbl, conname from pg_constraint
           where conname like '%\_company\_id\_fkey' escape '\' and not convalidated
             and connamespace = 'public'::regnamespace loop
    execute format('alter table %s validate constraint %I', r.tbl, r.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verify:
-- select table_name from information_schema.columns
--  where table_schema='public' and column_name='company_id' order by 1;

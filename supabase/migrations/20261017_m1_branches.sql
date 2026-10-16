-- M1 Multi-branch foundation (NZ / FJ / AU)
-- Adds branches, offices, staff_branches, agent_branch_codes, branch_id on owned header tables.
-- Branch = company + FDB + finance (data wall). Office = site inside a branch (ref prefix, address).
-- Backfills NZ. No RLS change, no UI change. Idempotent. Safe to re-run.
-- Finance schema NOT touched here: fin_stage_commit uses positional select *,
-- and full reload would wipe other branches. Handled in M3.
-- Existing customers.branch / staff_users.branch are ERP/legacy text, left as is.

begin;

-- 1. branches ---------------------------------------------------------------
create table if not exists public.branches (
  code           text primary key check (code ~ '^[A-Z]{2}$'),
  name           text not null,
  country_code   text not null,
  base_currency  text not null,
  timezone       text not null,
  fy_start_month int  check (fy_start_month between 1 and 12),
  erp_label      text,
  legal_name     text,
  address        text,
  phone          text,
  email          text,
  tax_label      text,
  logo_path      text,
  is_active      boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

insert into public.branches (code, name, country_code, base_currency, timezone, fy_start_month, erp_label, legal_name, tax_label, is_active, sort_order) values
  ('NZ', 'New Zealand', 'NZ', 'NZD', 'Pacific/Auckland', 4,    'TradeWindow NZ (UBNZ.FDB)', 'UB Freight Ltd', 'GST', true,  1),
  ('FJ', 'Fiji',        'FJ', 'FJD', 'Pacific/Fiji',     null, 'TradeWindow FJ', null, 'VAT', false, 2),
  ('AU', 'Australia',   'AU', 'AUD', 'Australia/Sydney', 7,    'TradeWindow AU', null, 'GST', false, 3)
on conflict (code) do nothing;

alter table public.branches enable row level security;
drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select to authenticated using (true);
drop policy if exists branches_admin on public.branches;
create policy branches_admin on public.branches for all to authenticated using (is_admin()) with check (is_admin());

-- 1b. offices (sites inside a branch) --------------------------------------
-- All offices in a branch share customers, ERP and finance. Staff see whole branch.
create table if not exists public.offices (
  code            text primary key check (code ~ '^[A-Z]{3}$'),
  branch_id       text not null references public.branches(code),
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
create unique index if not exists offices_branch_erp_code
  on public.offices (branch_id, erp_branch_code) where erp_branch_code is not null;

insert into public.offices (code, branch_id, name, city, unlocode, erp_branch_code, ref_prefix, is_active, sort_order) values
  ('AKL', 'NZ', 'Auckland', 'Auckland', 'NZAKL', 'AKL', 'AKL', true,  1),
  ('SUV', 'FJ', 'Suva',     'Suva',     'FJSUV', null,  'SUV', false, 1),
  ('LTK', 'FJ', 'Lautoka',  'Lautoka',  'FJLTK', null,  'LTK', false, 2),
  ('NAN', 'FJ', 'Nadi',     'Nadi',     'FJNAN', null,  'NAN', false, 3),
  ('SYD', 'AU', 'Sydney',   'Sydney',   'AUSYD', null,  'SYD', false, 1)
on conflict (code) do nothing;

alter table public.offices enable row level security;
drop policy if exists offices_read on public.offices;
create policy offices_read on public.offices for select to authenticated using (true);
drop policy if exists offices_admin on public.offices;
create policy offices_admin on public.offices for all to authenticated using (is_admin()) with check (is_admin());

-- 2. staff_branches ---------------------------------------------------------
create table if not exists public.staff_branches (
  user_id    uuid not null references public.staff_users(user_id) on delete cascade,
  branch_id  text not null references public.branches(code),
  access     text not null default 'full' check (access in ('full','network_viewer')),
  is_default boolean not null default false,
  home_office text references public.offices(code),
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);
create unique index if not exists staff_branches_one_default
  on public.staff_branches (user_id) where is_default;

insert into public.staff_branches (user_id, branch_id, access, is_default, home_office)
select user_id, 'NZ', 'full', true, 'AKL' from public.staff_users
on conflict (user_id, branch_id) do nothing;

alter table public.staff_branches enable row level security;
drop policy if exists staff_branches_read on public.staff_branches;
create policy staff_branches_read on public.staff_branches for select to authenticated
  using (user_id = auth.uid() or is_admin());
drop policy if exists staff_branches_admin on public.staff_branches;
create policy staff_branches_admin on public.staff_branches for all to authenticated
  using (is_admin()) with check (is_admin());

-- 3. agent_branch_codes (agents stay shared) --------------------------------
create table if not exists public.agent_branch_codes (
  agent_id   uuid not null references public.agents(id) on delete cascade,
  branch_id  text not null references public.branches(code),
  erp_code   text not null,
  created_at timestamptz not null default now(),
  primary key (agent_id, branch_id),
  unique (branch_id, erp_code)
);

insert into public.agent_branch_codes (agent_id, branch_id, erp_code)
select distinct on (upper(erp_account_code)) id, 'NZ', erp_account_code
from public.agents
where erp_account_code is not null and btrim(erp_account_code) <> ''
order by upper(erp_account_code), created_at
on conflict do nothing;

alter table public.agent_branch_codes enable row level security;
drop policy if exists agent_branch_codes_read on public.agent_branch_codes;
create policy agent_branch_codes_read on public.agent_branch_codes for select to authenticated using (is_staff());
drop policy if exists agent_branch_codes_admin on public.agent_branch_codes;
create policy agent_branch_codes_admin on public.agent_branch_codes for all to authenticated
  using (is_admin()) with check (is_admin());

-- 4. Helpers (not wired into RLS until M2) ----------------------------------
create or replace function public.has_branch(p_branch text)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from staff_branches sb join staff_users su on su.user_id = sb.user_id
    where sb.user_id = auth.uid() and su.is_active and sb.branch_id = p_branch and sb.access = 'full');
$$;

create or replace function public.my_branches()
returns setof text language sql stable security definer set search_path = public as $$
  select code from branches where is_admin()
  union
  select sb.branch_id from staff_branches sb join staff_users su on su.user_id = sb.user_id
  where sb.user_id = auth.uid() and su.is_active;
$$;

grant execute on function public.has_branch(text) to authenticated;
grant execute on function public.my_branches() to authenticated;

commit;

-- 5. branch_id on owned header tables ---------------------------------------
-- Child rows (lines, containers, comments) inherit branch from their parent.
-- Add column = metadata only (constant default). FK added NOT VALID then validated
-- (validate does not block writes). Default 'NZ' stays until M3 sync is branch-aware.
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
    execute format('alter table public.%I add column if not exists branch_id text not null default %L', t, 'NZ');
    if not exists (select 1 from pg_constraint where conname = t || '_branch_id_fkey'
                   and conrelid = ('public.' || t)::regclass) then
      execute format('alter table public.%I add constraint %I foreign key (branch_id) references public.branches(code) not valid',
                     t, t || '_branch_id_fkey');
    end if;
  end loop;
end $$;

do $$
declare r record;
begin
  for r in select conrelid::regclass as tbl, conname from pg_constraint
           where conname like '%\_branch\_id\_fkey' escape '\' and not convalidated
             and connamespace = 'public'::regnamespace loop
    execute format('alter table %s validate constraint %I', r.tbl, r.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verify:
-- select table_name from information_schema.columns
--  where table_schema='public' and column_name='branch_id' order by 1;

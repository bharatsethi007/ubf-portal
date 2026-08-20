-- Agents module — Step 1 schema.
-- Overseas partner (freehand agent) directory, decoupled from customers.
-- Applied live via Supabase MCP 20 Aug 2026. Repo-parity copy in supabase/migration/.

-- 1. agents ------------------------------------------------------------------
create table if not exists public.agents (
  id                uuid primary key default gen_random_uuid(),
  erp_account_code  text unique,                       -- = ACC_CLIENTS.ACCOUNTID / customers.account_id; null for prospects
  name              text not null,
  country           text,                              -- ISO alpha-2 or free text; often null from ERP
  source            text not null default 'prospect'
                      check (source in ('erp','prospect')),
  status            text not null default 'active'
                      check (status in ('active','prospect','inactive')),
  trusted           boolean not null default false,    -- Rohit-approved for shipment assignment
  approved_by       text,                              -- staff_users.user_id who approved trusted
  approved_at       timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.agents is
  'Overseas freehand agents. source=erp rows sync from ACC_CLIENTS where OS_AGENT=Y (keyed by erp_account_code=ACCOUNTID); source=prospect rows are hand-created conference cards with no ERP code yet. Networks are portal-owned via agent_networks. trusted is Rohit-approved (NOT ERP TRUSTED_TRADER_FLAG).';

create index if not exists idx_agents_status  on public.agents(status);
create index if not exists idx_agents_trusted on public.agents(trusted) where trusted = true;
create index if not exists idx_agents_country on public.agents(country);

-- 2. freight_networks (seeded) ----------------------------------------------
create table if not exists public.freight_networks (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,   -- short badge, e.g. WWPC
  name        text not null,
  sort_order  int not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.freight_networks (code, name, sort_order) values
  ('WWPC',      'Worldwide Partners Consortium', 10),
  ('WFN',       'World Freight Network',         20),
  ('LOGNET',    'Lognet',                        30),
  ('NAP',       'NAP',                           40),
  ('MIDPOINT',  'Freight Midpoint',              50),
  ('X2',        'X2',                            60),
  ('4NEXT',     '4Next',                         70)
on conflict (code) do nothing;

-- 3. agent_networks (many-to-many) ------------------------------------------
create table if not exists public.agent_networks (
  agent_id    uuid not null references public.agents(id) on delete cascade,
  network_id  uuid not null references public.freight_networks(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (agent_id, network_id)
);

create index if not exists idx_agent_networks_network on public.agent_networks(network_id);

-- 4. RLS — staff-only across the board --------------------------------------
alter table public.agents           enable row level security;
alter table public.freight_networks enable row level security;
alter table public.agent_networks   enable row level security;

drop policy if exists agents_staff_all on public.agents;
create policy agents_staff_all on public.agents
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists freight_networks_staff_all on public.freight_networks;
create policy freight_networks_staff_all on public.freight_networks
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists agent_networks_staff_all on public.agent_networks;
create policy agent_networks_staff_all on public.agent_networks
  for all using (public.is_staff()) with check (public.is_staff());

-- 5. Hide OS agents from the customer board ---------------------------------
-- Rebuild v_customer_stats to exclude any customer that is an agent.
-- Base customers table is unchanged, so bookings.os_agent_account_id FK + AR still resolve.
drop view if exists public.v_customer_stats;

create view public.v_customer_stats as
select
  c.account_id,
  c.name,
  c.branch,
  c.is_importer,
  c.is_exporter,
  c.closed,
  c.sales_manager,
  count(s.job_unique) as total_shipments,
  count(s.job_unique) filter (where s.status = 'In transit') as in_transit,
  count(s.job_unique) filter (where s.status like 'Arrived%') as arrived,
  count(s.job_unique) filter (where s.direction = 'import') as imports,
  count(s.job_unique) filter (where s.direction = 'export') as exports,
  count(s.job_unique) filter (where s.relevant_date >= date_trunc('month', current_date::timestamp with time zone)) as this_month,
  max(s.relevant_date) as last_activity,
  (select count(*) from contacts ct where ct.account_id = c.account_id) as contact_count,
  exists (select 1 from portal_users pu where pu.account_id = c.account_id) as has_portal_access
from customers c
left join public.agents a on a.erp_account_code = c.account_id
left join shipments s on s.customer_account_id = c.account_id
where a.erp_account_code is null           -- exclude OS agents from the customer board
group by
  c.account_id, c.name, c.branch, c.is_importer, c.is_exporter, c.closed, c.sales_manager;

notify pgrst, 'reload schema';

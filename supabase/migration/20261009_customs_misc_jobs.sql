-- Customs entries (TradeWindow CUSTMAIN) + misc/courier jobs (MISC_JOB).
-- Customs entry JOB_NO = the job number. Linked when an import (or other) leg has the same number;
-- otherwise standalone (customs-only / free-hand). Idempotent. Safe to re-run.

-- 1. Status code labels (CUSTOMSSTATUS_CODE_TSW), full refresh by sync
create table if not exists public.customs_status_codes (
  code text primary key,
  name text,
  synced_at timestamptz not null default now()
);

-- 2. Customs entries
create table if not exists public.customs_entries (
  id               bigint primary key,            -- CUSTMAIN.ID
  job_unique       bigint not null,               -- CUSTMAIN.JOB_NO (shared job number)
  linked_module    text,                          -- FIS/FIA/FES/FEA leg with same number, null = standalone
  is_standalone    boolean generated always as (linked_module is null) stored,
  account_id       text references public.customers(account_id),   -- CLIENTID
  importer         text,
  importer_code    text,                          -- NZ Customs client code
  house_bill       text,
  master_bill      text,
  frt_link         text,
  vessel_flight    text,
  nature           text,                          -- Sea / Air
  style            text,                          -- Normal / Simplified / IPI ...
  entry_type       text,                          -- Import ...
  port_loading     text,
  port_discharge   text,
  eta              date,
  final_ata        date,
  clear_date       date,
  customs_status   text,
  mpi_status       text,
  mpi_food_status  text,
  closed           boolean,
  handled_by       text,
  modified_by      text,
  created_src      timestamptz,
  modified_src     timestamptz,
  synced_at        timestamptz not null default now()
);
create index if not exists customs_entries_job_idx      on public.customs_entries (job_unique);
create index if not exists customs_entries_account_idx  on public.customs_entries (account_id);
create index if not exists customs_entries_created_idx  on public.customs_entries (created_src desc);
create index if not exists customs_entries_standalone_idx on public.customs_entries (account_id, created_src desc) where linked_module is null;

-- 3. Misc / courier jobs (COR invoices land on these job numbers)
create table if not exists public.misc_jobs (
  job_unique       bigint primary key,            -- MISC_JOB.JOB_UNIQUE
  source_id        bigint,                        -- MISC_JOB.ID
  job_no           text,
  account_id       text references public.customers(account_id),   -- CLIENTID
  job_type         text,
  category         text,
  reference        text,
  house_bill       text,
  master_bill      text,
  track_number     text,
  carrier          text,                          -- CART_CO
  vessel_flight    text,
  origin           text,
  destination      text,
  port_discharge   text,
  etd date, eta date, atd date, ata date,
  pack_qty         numeric,
  weight_kg        numeric,
  charged_kg       numeric,
  volume_m3        numeric,
  closed           boolean,
  pickup_account   text,
  delivery_account text,
  notes            text,
  created_src      timestamptz,
  modified_src     timestamptz,
  synced_at        timestamptz not null default now()
);
create index if not exists misc_jobs_account_idx on public.misc_jobs (account_id);
create index if not exists misc_jobs_created_idx on public.misc_jobs (created_src desc);

-- 4. Security: staff read only. Sync writes with service_role.
alter table public.customs_status_codes enable row level security;
alter table public.customs_entries      enable row level security;
alter table public.misc_jobs            enable row level security;

drop policy if exists staff_read_customs_status_codes on public.customs_status_codes;
create policy staff_read_customs_status_codes on public.customs_status_codes for select to authenticated using (is_staff());
drop policy if exists staff_read_customs_entries on public.customs_entries;
create policy staff_read_customs_entries on public.customs_entries for select to authenticated using (is_staff());
drop policy if exists staff_read_misc_jobs on public.misc_jobs;
create policy staff_read_misc_jobs on public.misc_jobs for select to authenticated using (is_staff());

revoke all on public.customs_status_codes, public.customs_entries, public.misc_jobs from anon, authenticated;
grant select on public.customs_status_codes, public.customs_entries, public.misc_jobs to authenticated;

-- 5. Labelled view for screens and reports
create or replace view public.v_customs_entries with (security_invoker = true) as
select e.*,
       cs.name as customs_status_label,
       ms.name as mpi_status_label,
       fs.name as mpi_food_status_label,
       c.name  as customer_name,
       case when e.linked_module is null then 'customs_only' else 'with_freight' end as job_kind
from public.customs_entries e
left join public.customs_status_codes cs on cs.code = e.customs_status
left join public.customs_status_codes ms on ms.code = e.mpi_status
left join public.customs_status_codes fs on fs.code = e.mpi_food_status
left join public.customers c on c.account_id = e.account_id;

revoke all on public.v_customs_entries from anon, authenticated;
grant select on public.v_customs_entries to authenticated;

-- Tidy: earlier view kept default write grants. Read-only for app users.
revoke all on public.v_transhipment_jobs from anon, authenticated;
grant select on public.v_transhipment_jobs to authenticated;

notify pgrst, 'reload schema';

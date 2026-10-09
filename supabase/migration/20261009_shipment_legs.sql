-- Shipment legs. Every leg of every ERP job. Key = module + job_unique.
-- TradeWindow transhipments share one JOB_UNIQUE across an import leg and an export leg.
-- public.shipments stays one row per job (billing leg); this table holds all legs.
-- Idempotent. Safe to re-run.

create table if not exists public.shipment_legs (like public.shipments including all);

do $$
begin
  if exists (select 1 from pg_constraint where conrelid='public.shipment_legs'::regclass and contype='p'
             and pg_get_constraintdef(oid) = 'PRIMARY KEY (job_unique)') then
    execute (select 'alter table public.shipment_legs drop constraint '||quote_ident(conname)
             from pg_constraint where conrelid='public.shipment_legs'::regclass and contype='p');
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.shipment_legs'::regclass and contype='p') then
    alter table public.shipment_legs alter column module set not null;
    alter table public.shipment_legs add constraint shipment_legs_pkey primary key (module, job_unique);
  end if;
  if not exists (select 1 from pg_constraint where conname='shipment_legs_customer_fkey') then
    alter table public.shipment_legs add constraint shipment_legs_customer_fkey
      foreign key (customer_account_id) references public.customers(account_id);
  end if;
end $$;

create index if not exists shipment_legs_job_unique_idx on public.shipment_legs (job_unique);

alter table public.shipment_legs enable row level security;
drop policy if exists staff_all_shipment_legs on public.shipment_legs;
create policy staff_all_shipment_legs on public.shipment_legs for select to authenticated using (is_staff());

revoke all on public.shipment_legs from anon, authenticated;
grant select on public.shipment_legs to authenticated;

create or replace view public.v_transhipment_jobs with (security_invoker = true) as
select job_unique,
       array_agg(module order by module) as modules,
       array_agg(customer_account_id order by module) as customers,
       min(created_src) as created_src
from public.shipment_legs
group by job_unique
having count(*) > 1;

revoke all on public.v_transhipment_jobs from anon;
grant select on public.v_transhipment_jobs to authenticated;

notify pgrst, 'reload schema';

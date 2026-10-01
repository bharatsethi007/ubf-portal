-- REPO PARITY ONLY. Applied live via Supabase MCP on 2026-10-02. Do not re-run.
-- Co-loader logos, per_wm / min / contingent surcharges, missing CN ports.
-- Data: MGF LCL FAK NZ Sep 2026 card (17 lanes + 3 surcharges) loaded via MCP.
alter table public.co_loaders add column if not exists logo_url text;
alter table public.rate_surcharges add column if not exists min_amount numeric;
alter table public.rate_surcharges add column if not exists contingent boolean not null default false;
alter table public.rate_surcharges drop constraint if exists rate_surcharges_basis_check;
alter table public.rate_surcharges add constraint rate_surcharges_basis_check check (basis = any (array['per_container','per_bl','per_cbm','per_wm','per_teu','per_kg','per_awb','percent','flat']));
insert into public.ports(code,name,lat,lng,kind,country_code) values
 ('CNSUD','Shunde',22.80,113.29,'sea','CN'),('CNFOS','Foshan',23.02,113.12,'sea','CN'),('CNZUH','Zhuhai',22.27,113.58,'sea','CN')
on conflict (code) do nothing;
update public.co_loaders set logo_url='/coloaders/mgf.png', name='MGF Logistics Group' where code='MGF';
notify pgrst, 'reload schema';

-- Second step (same day): origin agent per lane, country-scoped surcharges, CLS logo, 39 origin ports.
-- Data: Custom Logistic LCL NZ Imports Oct 2026 (324 lanes, 12 surcharges) loaded via MCP.
alter table public.rate_card_lcl_lines add column if not exists origin_agent text;
alter table public.rate_surcharges add column if not exists origin_countries text[];
alter table public.rate_surcharges add column if not exists except_origin_countries text[];
update public.co_loaders set name='Custom Logistic', logo_url='/coloaders/custom-logistic.png' where code='CLOG';
notify pgrst, 'reload schema';

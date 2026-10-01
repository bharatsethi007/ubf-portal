-- REPO PARITY ONLY. Applied live via Supabase MCP on 2026-10-02. Do not re-run.
-- UBF air consol / personal effects products + product-scoped air local charge sheets.
-- Data load (5 UBF tariff cards, 9 charge sheets, 104 lines from Export_Air_Tariff_July_2026.pdf) done via MCP.
alter table public.rate_cards add column if not exists air_product text not null default 'direct';
alter table public.rate_cards add column if not exists consol_schedule jsonb;
alter table public.rate_cards add column if not exists consol_skip_dates date[] not null default '{}';
alter table public.rate_cards drop constraint if exists rate_cards_air_product_chk;
alter table public.rate_cards add constraint rate_cards_air_product_chk check (air_product in ('direct','consol','personal_effects'));

alter table public.air_local_charge_sheets add column if not exists air_product text;
alter table public.air_local_charge_sheets add column if not exists dest_airport_codes text[] not null default '{}';
alter table public.air_local_charge_sheets add column if not exists cargo_class text not null default 'general';
alter table public.air_local_charge_sheets drop constraint if exists alcs_air_product_chk;
alter table public.air_local_charge_sheets add constraint alcs_air_product_chk check (air_product is null or air_product in ('direct','consol','personal_effects'));
alter table public.air_local_charge_sheets drop constraint if exists alcs_cargo_class_chk;
alter table public.air_local_charge_sheets add constraint alcs_cargo_class_chk check (cargo_class in ('general','dg'));

alter table public.air_local_charge_lines add column if not exists cargo_class text not null default 'any';
alter table public.air_local_charge_lines add column if not exists min_kg numeric;
alter table public.air_local_charge_lines add column if not exists max_kg numeric;
alter table public.air_local_charge_lines add column if not exists contingent boolean not null default false;
alter table public.air_local_charge_lines drop constraint if exists alcl_cargo_class_chk;
alter table public.air_local_charge_lines add constraint alcl_cargo_class_chk check (cargo_class in ('any','general','temp'));

notify pgrst, 'reload schema';

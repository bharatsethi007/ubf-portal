-- Applied live via MCP 1 Oct 2026 (migration charge_units_modes_and_code_default_unit). Idempotent.
alter table public.charge_units
  add column if not exists modes text[] not null default array['air','sea'];

update public.charge_units set modes = array['sea']
 where code in ('per_20','per_40','per_40hc','per_45hc','per_container','per_bl','per_cbm','per_wm');
update public.charge_units set modes = array['air','sea']
 where code in ('per_kg','per_shipment','per_clearance','flat');

insert into public.charge_units (code, label, sort_order, active, modes)
values ('per_awb', 'Per AWB', 65, true, array['air'])
on conflict (code) do update set modes = excluded.modes;

alter table public.charge_codes
  add column if not exists default_unit text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'charge_codes_default_unit_fkey') then
    alter table public.charge_codes
      add constraint charge_codes_default_unit_fkey foreign key (default_unit)
      references public.charge_units(code) on update cascade on delete set null;
  end if;
end $$;

update public.charge_codes set default_unit = 'per_kg'        where code in ('AFR','SSF') and default_unit is null;
update public.charge_codes set default_unit = 'per_shipment'  where code = 'DOC' and default_unit is null;
update public.charge_codes set default_unit = 'per_clearance' where code in ('CUS','CLEA_EA') and default_unit is null;

notify pgrst, 'reload schema';

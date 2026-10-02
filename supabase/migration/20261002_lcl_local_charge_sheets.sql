-- REPO PARITY ONLY. Applied live via Supabase MCP on 2026-10-02. Do not re-run.
-- Sea LCL Local/Port Charges share local_charge_sheets/lines with FCL via a mode column.
alter table public.local_charge_sheets add column if not exists mode text not null default 'fcl';
alter table public.local_charge_sheets drop constraint if exists local_charge_sheets_mode_chk;
alter table public.local_charge_sheets add constraint local_charge_sheets_mode_chk check (mode in ('fcl','lcl'));
alter table public.local_charge_sheets add column if not exists co_loader_codes text[] not null default '{}';
create index if not exists local_charge_sheets_mode_idx on public.local_charge_sheets(mode, direction);
alter table public.local_charge_lines drop constraint if exists local_charge_lines_basis_check;
alter table public.local_charge_lines add constraint local_charge_lines_basis_check check (basis = any (array['per_container','per_bl','per_shipment','percent','per_wm','per_cbm']));
notify pgrst, 'reload schema';

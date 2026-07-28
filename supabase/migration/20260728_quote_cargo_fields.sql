-- Cargo grid upgrade: real dimensional + weight fields on quote_cargo_lines,
-- plus a stackable flag on the quote header.

alter table public.quotes
  add column if not exists stackable text;   -- 'stackable' | 'non_stackable'

alter table public.quote_cargo_lines
  add column if not exists package_type text,
  add column if not exists quantity numeric,
  add column if not exists weight_unit text default 'KG',      -- KG | LB
  add column if not exists per_package_weight numeric,
  add column if not exists total_weight numeric,
  add column if not exists length numeric,
  add column if not exists width numeric,
  add column if not exists height numeric,
  add column if not exists dim_unit text default 'CM',         -- CM | M | IN
  add column if not exists total_cbm numeric,
  add column if not exists override_chargeable boolean not null default false;

-- Note: existing columns cargo_description, packages, volume_cbm, volume_wt,
-- gross_wt, chargeable_wt remain. volume_cbm now holds per-package CBM,
-- total_cbm holds line total. chargeable_wt is computed app-side
-- (air = max(gross, CBM*167); sea = CBM only), editable when override_chargeable.

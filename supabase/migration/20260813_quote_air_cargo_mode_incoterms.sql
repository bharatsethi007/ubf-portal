-- Air cargo entry: total-shipment vs individual-consignment mode + incoterms on quotes.
-- cargo_entry_mode governs which entry UI drives chargeable weight:
--   'individual' -> per-piece L*W*H rows in quote_cargo_lines (existing behaviour, safe backfill default)
--   'total'      -> a single dimensionless aggregate line (pieces / commodity / gross / cbm)
-- incoterm stores the 3-letter code; validity (air = EXW/FCA/CPT/CIP/DAP/DPU/DDP) is enforced in the UI.
alter table public.quotes
  add column if not exists cargo_entry_mode text not null default 'individual',
  add column if not exists incoterm text,
  add column if not exists incoterm_named_place text;

alter table public.quotes drop constraint if exists quotes_cargo_entry_mode_check;
alter table public.quotes
  add constraint quotes_cargo_entry_mode_check
  check (cargo_entry_mode in ('total','individual'));

notify pgrst, 'reload schema';

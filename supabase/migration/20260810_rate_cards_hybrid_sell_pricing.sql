-- Hybrid sell pricing on rate cards:
-- explicit per-line sell + optional card-level default markup that pre-fills it.
-- All additive & nullable; RLS unchanged (staff-only inherited from tables).
-- NOTE: already applied to live DB via Supabase MCP; this file is repo parity only.

alter table public.rate_cards
  add column if not exists default_markup_pct numeric;

-- sell_rate already existed live (added out-of-band); kept here for repo parity.
alter table public.rate_card_fcl_lines
  add column if not exists sell_rate numeric;

alter table public.rate_card_lcl_lines
  add column if not exists sell_per_wm numeric,
  add column if not exists sell_min    numeric;

alter table public.rate_surcharges
  add column if not exists sell_amount numeric;

notify pgrst, 'reload schema';

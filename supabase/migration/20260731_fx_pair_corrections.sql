-- 20260731_fx_pair_corrections.sql  (already applied to production)
alter table public.exchange_rates
  add column if not exists buy_correction_pct numeric not null default 0,
  add column if not exists sell_correction_pct numeric not null default 0;
drop policy if exists fx_margins_staff_all on public.fx_margins;
drop table if exists public.fx_margins;

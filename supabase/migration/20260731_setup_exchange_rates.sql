-- 20260731_setup_exchange_rates.sql  (already applied to production)
create table if not exists public.exchange_rates (
  base_currency text not null, quote_currency text not null, rate numeric not null,
  as_of date not null default current_date, source text not null default 'open.er-api.com',
  updated_at timestamptz not null default now(),
  primary key (base_currency, quote_currency));
create table if not exists public.fx_margins (
  currency text primary key, margin_pct numeric not null default 0,
  updated_at timestamptz not null default now());
insert into public.fx_margins (currency, margin_pct) values ('*', 0) on conflict (currency) do nothing;
alter table public.exchange_rates enable row level security;
alter table public.fx_margins enable row level security;
create policy exchange_rates_staff_all on public.exchange_rates for all using (is_staff()) with check (is_staff());
create policy fx_margins_staff_all on public.fx_margins for all using (is_staff()) with check (is_staff());

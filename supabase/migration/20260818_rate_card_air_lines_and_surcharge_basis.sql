-- Air rate lines (per-kg with fixed weight breaks) + widen shared surcharge basis for air

create table if not exists public.rate_card_air_lines (
  id uuid primary key default gen_random_uuid(),
  rate_card_id uuid not null references public.rate_cards(id) on delete cascade,
  origin_port_code text,
  origin_group_code text,
  dest_port_code text not null,
  min_charge numeric,          -- flat minimum charge (MIN)
  rate_n numeric,              -- normal rate, under 45kg (per kg)
  rate_45 numeric,             -- +45kg  (per kg)
  rate_100 numeric,            -- +100kg (per kg)
  rate_250 numeric,            -- +250kg (per kg)
  rate_500 numeric,            -- +500kg (per kg)
  rate_1000 numeric,           -- +1000kg (per kg)
  markup_pct numeric,          -- per-line sell markup override; falls back to card default_markup_pct
  currency_code text references public.currencies(code),
  transit_days integer,
  via text,
  frequency text,
  confidence text default 'green' check (confidence in ('green','amber','red')),
  raw_origin text,
  created_at timestamptz not null default now(),
  constraint rate_card_air_lines_origin_chk check (origin_port_code is not null or origin_group_code is not null)
);
create index if not exists idx_rate_card_air_lines_card on public.rate_card_air_lines(rate_card_id);
alter table public.rate_card_air_lines enable row level security;
drop policy if exists staff_all_rate_card_air_lines on public.rate_card_air_lines;
create policy staff_all_rate_card_air_lines on public.rate_card_air_lines
  for all using (public.is_staff()) with check (public.is_staff());

do $$
declare cn text;
begin
  select conname into cn from pg_constraint
   where conrelid = 'public.rate_surcharges'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%basis%';
  if cn is not null then execute format('alter table public.rate_surcharges drop constraint %I', cn); end if;
end $$;
alter table public.rate_surcharges add constraint rate_surcharges_basis_check
  check (basis = any (array['per_container','per_bl','per_cbm','per_teu','per_kg','per_awb','percent','flat']));

notify pgrst, 'reload schema';

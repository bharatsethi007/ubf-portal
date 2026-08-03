create table if not exists public.rate_card_lcl_lines (
  id                uuid primary key default gen_random_uuid(),
  rate_card_id      uuid not null references public.rate_cards(id) on delete cascade,
  origin_port_code  text references public.ports(code),
  origin_group_code text references public.port_groups(code),
  dest_port_code    text not null references public.ports(code),
  rate_per_wm       numeric not null,
  min_charge        numeric,
  currency_code     text references public.currencies(code),
  transit_days      integer,
  via               text,
  valid_from        date,
  valid_to          date,
  confidence        text not null default 'green' check (confidence in ('green','amber','red')),
  raw_origin        text,
  created_at        timestamptz not null default now(),
  constraint lcl_line_origin_present check (origin_port_code is not null or origin_group_code is not null)
);
create index if not exists rate_card_lcl_lines_card_idx on public.rate_card_lcl_lines(rate_card_id);
create index if not exists rate_card_lcl_lines_lane_idx on public.rate_card_lcl_lines(dest_port_code);
alter table public.rate_card_lcl_lines enable row level security;
create policy staff_all_rate_card_lcl_lines on public.rate_card_lcl_lines
  for all using (is_staff()) with check (is_staff());

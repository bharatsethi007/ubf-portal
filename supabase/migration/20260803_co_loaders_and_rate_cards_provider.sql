create table if not exists public.co_loaders (
  code text primary key,
  name text not null,
  sort_order integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.co_loaders enable row level security;
create policy co_loaders_staff_all on public.co_loaders
  for all using (is_staff()) with check (is_staff());
insert into public.co_loaders (code, name, sort_order) values
  ('MGF','MGF',1),('CARO','Carotrans',2),('ECU','Ecu Line',3),('PFM','PFM',4),
  ('OCB','Oceanbridge',5),('WCP','WCP',6),('CLOG','Customs Logistics',7),('NGS','NGS',8)
on conflict (code) do nothing;
alter table public.rate_cards add column if not exists co_loader_code text references public.co_loaders(code);
alter table public.rate_cards alter column shipping_line_code drop not null;
update public.rate_cards set co_loader_code='CARO', shipping_line_code=null
  where rate_type='lcl' and co_loader_code is null;
alter table public.rate_cards add constraint rate_cards_provider_present check (
  (rate_type='lcl' and co_loader_code is not null)
  or (rate_type<>'lcl' and shipping_line_code is not null)
);

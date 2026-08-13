create table if not exists public.airlines (
  code text primary key,
  name text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.airlines enable row level security;

drop policy if exists airlines_staff_all on public.airlines;
create policy airlines_staff_all on public.airlines
  for all using (is_staff()) with check (is_staff());

insert into public.airlines (code, name, sort_order) values
  ('FJ','Fiji Airways',10),('NZ','Air New Zealand',20),('QF','Qantas',30),
  ('VA','Virgin Australia',40),('SB','Aircalin',50),('ON','Nauru Airlines',60),
  ('SQ','Singapore Airlines',70),('CX','Cathay Pacific',80),('EK','Emirates',90),
  ('QR','Qatar Airways',100)
on conflict (code) do nothing;

notify pgrst, 'reload schema';

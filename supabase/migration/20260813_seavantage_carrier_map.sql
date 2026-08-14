-- Maps our house shipping-line codes -> SeaVantage carrierCode, flags the Maersk skip-set,
-- and carries known container prefixes for fallback carrier detection.
-- Seeded to the verified live state (codes checked against SeaVantage's supported-carrier list).
create table if not exists public.sv_carrier_map (
  line_code       text primary key references public.shipping_lines(code),
  sv_carrier_code text,
  is_maersk       boolean not null default false,
  verified        boolean not null default false,
  known_prefixes  text[]  not null default '{}',
  notes           text,
  updated_at      timestamptz not null default now()
);

alter table public.sv_carrier_map enable row level security;
drop policy if exists staff_all_sv_carrier_map on public.sv_carrier_map;
create policy staff_all_sv_carrier_map on public.sv_carrier_map
  for all using (public.is_staff()) with check (public.is_staff());

insert into public.sv_carrier_map (line_code, sv_carrier_code, is_maersk, verified, known_prefixes, notes) values
  ('ANL',     'ANNU', false, true,  '{ANNU}',                                'ANL'),
  ('CMACGM',  'CMAL', false, true,  '{CMAU,CGMU,CMDU,ECMU}',                 'CMA CGM -- SeaVantage uses CMAL (not CMDU)'),
  ('COSCO',   'COSU', false, true,  '{COSU,CSNU,CBHU,CCLU}',                 'COSCO'),
  ('HAPAG',   'HLCU', false, true,  '{HLCU,HLXU,HPLU,UACU,CPSU}',            'Hapag-Lloyd'),
  ('MAERSK',  'MAEU', true,  false, '{MAEU,MRKU,MSKU,MSFU,MRSU,SUDU,SEGU,SEAU,MCAU,PONU}', 'Maersk group -- stays on the free Maersk API, never SeaVantage'),
  ('MATSON',  'MATS', false, true,  '{MATU}',                                'Matson'),
  ('MSC',     'MSCU', false, true,  '{MSCU,MEDU,MSDU}',                      'MSC'),
  ('NEPTUNE', 'NPDL', false, true,  '{}',                                    'Neptune Pacific Direct Line'),
  ('ONE',     'ONEY', false, true,  '{ONEU,ONEY,NYKU,MOTU,KKFU}',           'Ocean Network Express'),
  ('OOCL',    'OOLU', false, true,  '{OOLU,OOCU}',                          'OOCL'),
  ('PIL',     'PABV', false, true,  '{PCIU,PILU}',                          'Pacific International Lines'),
  ('SOFRANA', 'SOFU', false, true,  '{}',                                    'Sofrana Unilines')
on conflict (line_code) do nothing;

notify pgrst, 'reload schema';

alter table public.quote_response_lines
  add column if not exists charge_group text
  check (charge_group in ('origin', 'freight', 'destination'));
alter table public.quote_response_lines
  alter column charge_group set default 'freight';
update public.quote_response_lines set charge_group = 'freight' where charge_group is null;

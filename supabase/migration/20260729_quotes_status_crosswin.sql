-- Allow 'crosswin' as a quote outcome alongside won/lost
alter table public.quotes drop constraint if exists quotes_status_check;

alter table public.quotes
  add constraint quotes_status_check
  check (status in ('open','published','sent','won','lost','crosswin'));

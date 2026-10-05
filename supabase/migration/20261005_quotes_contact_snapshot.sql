-- Customer POC on quote PDF. Snapshot so ERP contact sync never changes a sent quote.
alter table public.quotes
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
comment on column public.quotes.contact_name is 'Customer POC printed on quote PDF. Snapshot; null = customer default contact.';

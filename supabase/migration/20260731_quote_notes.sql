-- 20260731_quote_notes.sql  (already applied to production)
alter table public.quotes
  add column if not exists internal_notes text,
  add column if not exists external_notes text;

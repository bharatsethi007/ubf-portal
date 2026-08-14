-- Applied live via MCP 15 Aug 2026. Repo-parity only — do not re-run via CLI.
alter table public.booking_tasks
  add column if not exists billable boolean not null default false,
  add column if not exists invoice_no text;

comment on column public.booking_tasks.billable is
  'Task requires billing to customer; completion requires an invoice number.';
comment on column public.booking_tasks.invoice_no is
  'Invoice number captured when a billable task is completed.';

notify pgrst, 'reload schema';

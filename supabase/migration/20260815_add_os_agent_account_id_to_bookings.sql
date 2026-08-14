-- Applied live via MCP 15 Aug 2026. Repo-parity only — do not re-run via CLI.
alter table public.bookings
  add column if not exists os_agent_account_id text;

alter table public.bookings
  add constraint bookings_os_agent_account_id_fkey
  foreign key (os_agent_account_id)
  references public.customers(account_id);

comment on column public.bookings.os_agent_account_id is
  'Overseas agent (customer FK). Manually linked for now; to be wired from ERP job party later.';

notify pgrst, 'reload schema';

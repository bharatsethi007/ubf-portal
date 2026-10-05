-- APPLIED LIVE 5 Oct 2026 via MCP. Repo parity only. DO NOT RE-RUN.
alter table public.bookings add column if not exists os_agent_id uuid references public.agents(id) on delete set null;
create index if not exists bookings_os_agent_id_idx on public.bookings (os_agent_id) where os_agent_id is not null;
update public.bookings b set os_agent_id = a.id from public.agents a
 where b.os_agent_id is null and b.os_agent_account_id is not null and a.erp_account_code = b.os_agent_account_id;
notify pgrst, 'reload schema';

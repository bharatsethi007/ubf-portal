-- 20260629_sli_events.sql
-- Audit trail for SLI lifecycle. Project cpnkudbdzgnzmodhsrbf. Apply via MCP apply_migration.

create table if not exists public.sli_events (
  id         uuid primary key default gen_random_uuid(),
  sli_id     uuid not null references public.sli_documents(id) on delete cascade,
  event      text not null,         -- created | sent | viewed | endorsed | changes_requested
                                     -- | expired | edits_accepted | regenerated | email_sent | email_failed
  detail     jsonb not null default '{}'::jsonb,
  actor      uuid references auth.users(id),   -- staff actor when applicable; null for customer/system
  created_at timestamptz not null default now()
);
create index if not exists ix_sli_events_sli on public.sli_events (sli_id, created_at);

alter table public.sli_events enable row level security;
drop policy if exists sli_events_staff on public.sli_events;
create policy sli_events_staff on public.sli_events
  for select to authenticated
  using (exists (select 1 from staff_users where user_id = auth.uid()));
-- writes happen via service role (Edge Functions) and the trigger below.

-- auto-log status transitions on sli_documents
create or replace function public.log_sli_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into sli_events (sli_id, event, actor, detail)
    values (new.id, 'created', new.created_by, jsonb_build_object('status', new.status));
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into sli_events (sli_id, event, actor, detail)
    values (new.id, new.status::text, new.created_by,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_sli_status on public.sli_documents;
create trigger trg_log_sli_status
  after insert or update on public.sli_documents
  for each row execute function public.log_sli_status();

-- read access to events for the staff app
grant select on public.sli_events to authenticated;

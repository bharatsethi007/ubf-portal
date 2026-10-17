-- Sync button: per-company queue + agent heartbeat.
-- The portal "Sync now" button queues a row in sync_jobs; sync_agent.py on the server
-- claims it and runs sync_all.ps1 for that company. The agent writes a heartbeat to
-- sync_agents so the button can say "agent offline" instead of spinning forever.

-- 1. sync_jobs gets a company (existing rows are NZ)
alter table public.sync_jobs add column if not exists company_id text not null default 'NZ'
  references public.companies(code);
alter table public.sync_jobs alter column company_id set default public.current_company();
create index if not exists sync_jobs_company_status on public.sync_jobs (company_id, status, requested_at desc);

-- 2. Clear requests nobody picked up (7–8 Oct presses)
update public.sync_jobs
   set status = 'error', finished_at = now(), message = 'Abandoned: sync agent was not running'
 where status in ('pending', 'running') and requested_at < now() - interval '30 minutes';

-- 3. Agent heartbeat, one row per company
create table if not exists public.sync_agents (
  company_id text primary key references public.companies(code),
  host       text,
  fdb        text,
  version    text,
  started_at timestamptz,
  last_seen  timestamptz not null default now(),
  state      text not null default 'idle',          -- idle | syncing
  next_auto  timestamptz
);
alter table public.sync_agents enable row level security;
drop policy if exists staff_read_sync_agents on public.sync_agents;
create policy staff_read_sync_agents on public.sync_agents for select
  using (exists (select 1 from public.staff_users su where su.user_id = auth.uid()));

-- Same company wall as every other company table
drop policy if exists zz_company_scope on public.sync_jobs;
create policy zz_company_scope on public.sync_jobs as restrictive for all
  using (not (select public.is_staff()) or company_id in (select public.my_scope()))
  with check (not (select public.is_staff()) or company_id in (select public.my_companies()));
drop policy if exists zz_company_scope on public.sync_agents;
create policy zz_company_scope on public.sync_agents as restrictive for all
  using (not (select public.is_staff()) or company_id in (select public.my_scope()));

-- 4. Button RPC: reuse an open request instead of stacking duplicates
create or replace function public.request_sync()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_company text := public.current_company();
  v_email   text;
  v_job     public.sync_jobs;
begin
  if not exists (select 1 from public.staff_users where user_id = auth.uid()) then
    raise exception 'Staff only';
  end if;
  select email into v_email from auth.users where id = auth.uid();

  select * into v_job from public.sync_jobs
   where company_id = v_company and status in ('pending', 'running')
   order by requested_at desc limit 1;

  if not found then
    insert into public.sync_jobs (requested_by, company_id)
    values (coalesce(v_email, 'staff'), v_company)
    returning * into v_job;
  end if;

  return public.sync_status();
end $$;

-- 5. Status for the button: latest job, last good run, agent heartbeat (current company)
create or replace function public.sync_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_company text := public.current_company();
begin
  if not exists (select 1 from public.staff_users where user_id = auth.uid()) then
    raise exception 'Staff only';
  end if;
  return jsonb_build_object(
    'company', v_company,
    'job', (select to_jsonb(j) from (
        select id, status, requested_by, requested_at, started_at, finished_at, left(message, 2000) as message
          from public.sync_jobs where company_id = v_company
         order by requested_at desc limit 1) j),
    'last_done', (select max(finished_at) from public.sync_jobs
                   where company_id = v_company and status = 'done'),
    'agent', (select to_jsonb(a) from (
        select host, version, started_at, last_seen, state, next_auto,
               (last_seen > now() - interval '2 minutes') as online
          from public.sync_agents where company_id = v_company) a)
  );
end $$;

revoke all on function public.request_sync() from public, anon;
revoke all on function public.sync_status() from public, anon;
grant execute on function public.request_sync() to authenticated;
grant execute on function public.sync_status() to authenticated;

select public.apply_company_scope();

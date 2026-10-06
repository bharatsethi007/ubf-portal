-- Booking email send (Outlook / MS Graph). 7 Oct 2026. Idempotent, safe to re-run.
-- module_mailboxes: which shared mailbox each booking module sends from.
-- email_contacts: address book that grows from every send (trucking companies, customers).

create table if not exists public.module_mailboxes (
  module text primary key,
  mailbox text not null,
  display_name text not null default 'UB Freight',
  updated_at timestamptz not null default now()
);
alter table public.module_mailboxes enable row level security;
drop policy if exists module_mailboxes_staff on public.module_mailboxes;
create policy module_mailboxes_staff on public.module_mailboxes for all using (is_staff()) with check (is_staff());
insert into public.module_mailboxes (module, mailbox, display_name)
values ('IS', 'importsea.nz@ubfreight.com', 'UB Freight Import Sea')
on conflict (module) do nothing;

create table if not exists public.email_contacts (
  email text primary key check (email = lower(email)),
  name text,
  company text,
  kind text not null default 'other' check (kind in ('trucker','customer','agent','other')),
  use_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_contacts enable row level security;
drop policy if exists email_contacts_staff on public.email_contacts;
create policy email_contacts_staff on public.email_contacts for all using (is_staff()) with check (is_staff());
create index if not exists email_contacts_used_idx on public.email_contacts (kind, last_used_at desc);

-- Called by booking-email-send (service role) after a successful send.
create or replace function public.email_contacts_touch(p_emails text[], p_kind text)
returns void language sql security definer set search_path = public as $$
  insert into email_contacts (email, kind, use_count, last_used_at)
  select distinct lower(trim(e)), coalesce(p_kind, 'other'), 1, now()
  from unnest(p_emails) e where trim(e) <> ''
  on conflict (email) do update
    set use_count = email_contacts.use_count + 1,
        last_used_at = now(),
        kind = case when email_contacts.kind = 'other' then excluded.kind else email_contacts.kind end;
$$;
revoke all on function public.email_contacts_touch(text[], text) from public, anon, authenticated;

notify pgrst, 'reload schema';

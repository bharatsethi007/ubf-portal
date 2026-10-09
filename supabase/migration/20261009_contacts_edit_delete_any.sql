-- Staff can edit or delete any customer contact, including CF-synced ones.
-- CF sync upserts on (account_id, email, first_name, last_name). When staff edit or delete a CF row,
-- its original key goes into contact_suppressions so the next sync cannot bring the old row back.
-- Edited CF rows become source = 'console' (owned by the portal from then on).

create table if not exists public.contact_suppressions (
  id bigserial primary key,
  account_id text not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  reason text not null check (reason in ('edited', 'deleted')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists contact_suppressions_key
  on public.contact_suppressions (account_id, lower(email), first_name, last_name);
alter table public.contact_suppressions enable row level security;
drop policy if exists staff_read_contact_suppressions on public.contact_suppressions;
create policy staff_read_contact_suppressions on public.contact_suppressions for select using (is_staff());

-- Block sync inserts (source 'cf') of suppressed keys. Returning NULL also skips ON CONFLICT updates.
create or replace function public.contacts_block_suppressed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.source, 'cf') = 'cf' and exists (
    select 1 from contact_suppressions s
    where s.account_id = new.account_id and lower(s.email) = lower(new.email)
      and s.first_name = new.first_name and s.last_name = new.last_name
  ) then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists trg_contacts_block_suppressed on public.contacts;
create trigger trg_contacts_block_suppressed before insert on public.contacts
  for each row execute function public.contacts_block_suppressed();

create or replace function public.contact_suppress(c public.contacts, p_reason text)
returns void language sql security definer set search_path = public as $$
  insert into contact_suppressions (account_id, email, first_name, last_name, reason)
  select c.account_id, c.email, c.first_name, c.last_name, p_reason
  where c.source = 'cf' and c.email is not null and c.first_name is not null and c.last_name is not null
  on conflict do nothing;
$$;

create or replace function public.contact_edit(
  p_id bigint, p_first_name text, p_last_name text, p_email text, p_phone text
) returns void language plpgsql security definer set search_path = public as $$
declare c contacts;
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  select * into c from contacts where id = p_id for update;
  if not found then raise exception 'Contact not found'; end if;
  perform contact_suppress(c, 'edited');
  update contacts set
    first_name = nullif(trim(p_first_name), ''),
    last_name  = nullif(trim(p_last_name), ''),
    email      = nullif(lower(trim(p_email)), ''),
    phone      = nullif(trim(p_phone), ''),
    source     = 'console',
    synced_at  = null,
    updated_at = now()
  where id = p_id;
exception when unique_violation then
  raise exception 'That contact already exists';
end $$;

create or replace function public.contact_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare c contacts;
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  select * into c from contacts where id = p_id for update;
  if not found then return; end if;
  perform contact_suppress(c, 'deleted');
  delete from contacts where id = p_id;
end $$;

revoke all on function public.contact_suppress(public.contacts, text) from public, anon, authenticated;
revoke all on function public.contact_edit(bigint, text, text, text, text) from public, anon;
revoke all on function public.contact_delete(bigint) from public, anon;
grant execute on function public.contact_edit(bigint, text, text, text, text) to authenticated;
grant execute on function public.contact_delete(bigint) to authenticated;

notify pgrst, 'reload schema';

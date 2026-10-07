-- Customer contacts added in the console. CF sync upserts on (account_id, email, first_name, last_name)
-- and never sets `source`, so synced rows stay 'cf' and console rows stay 'console'.
alter table public.contacts add column if not exists source text not null default 'cf';
alter table public.contacts add column if not exists created_by uuid;
alter table public.contacts add column if not exists updated_at timestamptz;

drop policy if exists staff_insert_console_contacts on public.contacts;
create policy staff_insert_console_contacts on public.contacts for insert
  with check (is_staff() and source = 'console');
drop policy if exists staff_update_console_contacts on public.contacts;
create policy staff_update_console_contacts on public.contacts for update
  using (is_staff() and source = 'console') with check (is_staff() and source = 'console');
drop policy if exists staff_delete_console_contacts on public.contacts;
create policy staff_delete_console_contacts on public.contacts for delete
  using (is_staff() and source = 'console');

grant insert, update, delete on public.contacts to authenticated;
grant usage on sequence public.contacts_id_seq to authenticated;

notify pgrst, 'reload schema';

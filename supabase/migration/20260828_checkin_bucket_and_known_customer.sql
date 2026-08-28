-- Applied live via MCP on 2026-08-28. This file is repo-parity only — do not re-run.
-- Private storage bucket for check-in signatures + cargo photos (signed-URL access, staff-only)
insert into storage.buckets (id, name, public)
values ('checkin', 'checkin', false)
on conflict (id) do nothing;

create policy "checkin_staff_read" on storage.objects
  for select using (bucket_id = 'checkin' and is_staff());
create policy "checkin_staff_write" on storage.objects
  for insert with check (bucket_id = 'checkin' and is_staff());
create policy "checkin_staff_update" on storage.objects
  for update using (bucket_id = 'checkin' and is_staff());
create policy "checkin_staff_delete" on storage.objects
  for delete using (bucket_id = 'checkin' and is_staff());

-- Known-customer flag on the check-in sheet (consignee section toggle)
alter table public.tms_checkin_sheets
  add column if not exists known_customer boolean not null default false;

notify pgrst, 'reload schema';

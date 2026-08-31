-- Let any staff read the full staff directory (for the Users list). APPLIED LIVE 2026-08-31.
create policy staff_read_all on public.staff_users for select using (public.is_staff());
notify pgrst, 'reload schema';

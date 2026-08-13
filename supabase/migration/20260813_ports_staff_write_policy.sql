alter table public.ports enable row level security;

drop policy if exists ports_staff_write on public.ports;
create policy ports_staff_write on public.ports
  for all using (is_staff()) with check (is_staff());

notify pgrst, 'reload schema';

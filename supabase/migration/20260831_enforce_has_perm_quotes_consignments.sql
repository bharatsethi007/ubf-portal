-- Per-operation has_perm enforcement on writes. Reads stay staff-wide. APPLIED LIVE 2026-08-31.
drop policy if exists quotes_staff_all on public.quotes;
create policy quotes_select on public.quotes for select using (public.is_staff());
create policy quotes_insert on public.quotes for insert with check (public.has_perm('quotes','add'));
create policy quotes_update on public.quotes for update using (public.has_perm('quotes','edit')) with check (public.has_perm('quotes','edit'));
create policy quotes_delete on public.quotes for delete using (public.has_perm('quotes','delete'));

drop policy if exists staff_all on public.tms_consignments;
create policy tms_consignments_select on public.tms_consignments for select using (public.is_staff());
create policy tms_consignments_insert on public.tms_consignments for insert with check (public.has_perm('tms','add'));
create policy tms_consignments_update on public.tms_consignments for update using (public.has_perm('tms','edit')) with check (public.has_perm('tms','edit'));
create policy tms_consignments_delete on public.tms_consignments for delete using (public.has_perm('tms','delete'));

notify pgrst, 'reload schema';

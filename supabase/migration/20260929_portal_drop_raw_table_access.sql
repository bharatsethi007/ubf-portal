-- 20260929_portal_drop_raw_table_access.sql
-- Portal users now read only via portal_* views (20260929_portal_safe_views.sql).
-- Remove their raw-table SELECT so internal columns are unreachable. Staff policies untouched.
drop policy if exists own_shipments on public.shipments;
drop policy if exists own_invoices on public.invoices;
drop policy if exists own_containers on public.containers;
drop policy if exists own_customer on public.customers;
drop policy if exists own_contacts on public.contacts;
drop policy if exists portal_select_bookings on public.bookings;

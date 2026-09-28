-- 20260929_portal_safe_views.sql
-- Customer portal reads ONLY through these views. Each view:
--   * exposes a whitelisted set of columns (no internal fields)
--   * filters to the caller's account via my_account_id() (active users only)
-- Views run as owner, so they work even after raw-table portal policies are dropped.

create or replace view public.portal_shipments as
select s.job_unique, s.module, s.mode, s.direction, s.house_bill, s.job_no, s.shipment_no,
       s.origin, s.destination, s.vessel_flight, s.etd, s.eta, s.departed, s.arrived, s.doc_date,
       s.relevant_date, s.created_src, s.shipper_name, s.consignee_name, s.customer_ref, s.load_type,
       s.consol_key, s.goods_desc, s.pack_qty, s.pack_type, s.weight_kg, s.volume_m3, s.marks,
       s.final_dest, s.master_bill, s.status,
       c.name as customer_name
  from public.shipments s
  left join public.customers c on c.account_id = s.customer_account_id
 where s.customer_account_id = public.my_account_id();

create or replace view public.portal_invoices as
select i.invoice_no, i.doctype, i.module, i.job_unique, i.doc_date, i.date_due,
       i.amt_local, i.balance, i.tax_amount, i.currency
  from public.invoices i
 where i.account_id = public.my_account_id();

create or replace view public.portal_containers as
select ct.id, ct.consol_key, ct.c_number, ct.seal, ct.container_size, ct.avail_from, ct.avail_to
  from public.containers ct
 where exists (
   select 1 from public.shipments s
    where s.consol_key = ct.consol_key
      and s.customer_account_id = public.my_account_id()
 );

create or replace view public.portal_bookings as
select b.id, b.shipment_id, b.delivery_date, b.updated_at
  from public.bookings b
 where b.account_id = public.my_account_id();

create or replace view public.portal_account as
select c.account_id, c.name
  from public.customers c
 where c.account_id = public.my_account_id();

revoke all on public.portal_shipments, public.portal_invoices, public.portal_containers,
              public.portal_bookings, public.portal_account from anon, public;
grant select on public.portal_shipments, public.portal_invoices, public.portal_containers,
                public.portal_bookings, public.portal_account to authenticated;

-- 20260929_portal_shipments_stage_active.sql
-- portal_shipments gains stage (1 booked, 2 in transit, 3 arrived) and is_active for the v2 home.
create or replace view public.portal_shipments as
select s.job_unique, s.module, s.mode, s.direction, s.house_bill, s.job_no, s.shipment_no,
       s.origin, s.destination, s.vessel_flight, s.etd, s.eta, s.departed, s.arrived, s.doc_date,
       s.relevant_date, s.created_src, s.shipper_name, s.consignee_name, s.customer_ref, s.load_type,
       s.consol_key, s.goods_desc, s.pack_qty, s.pack_type, s.weight_kg, s.volume_m3, s.marks,
       s.final_dest, s.master_bill, s.status,
       c.name as customer_name,
       case
         when s.status ilike 'arrived%' then 3
         when s.status = 'In transit' then 2
         else 1
       end as stage,
       case
         when s.status in ('Booked', 'Scheduled') then s.doc_date >= current_date - 45
         when s.status = 'In transit' then true
         when s.status ilike 'arrived%' then coalesce(s.arrived::date, s.eta) >= current_date - 14
         else false
       end as is_active
  from public.shipments s
  left join public.customers c on c.account_id = s.customer_account_id
 where s.customer_account_id = public.my_account_id();

revoke all on public.portal_shipments from anon, public;
grant select on public.portal_shipments to authenticated;

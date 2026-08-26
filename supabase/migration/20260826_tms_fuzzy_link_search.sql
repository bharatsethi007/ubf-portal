-- ============================================================
-- TMS fuzzy + active booking/shipment link search.
-- Applied live to cpnkudbdzgnzmodhsrbf on 26 Aug 2026 via MCP.
-- Repo-parity copy for supabase/migration.
-- ============================================================

create index if not exists tms_bookings_ref_trgm on public.bookings using gin (booking_ref gin_trgm_ops);
create index if not exists tms_shipments_hbl_trgm on public.shipments using gin (house_bill gin_trgm_ops);
create index if not exists tms_shipments_relevant_date_idx on public.shipments (relevant_date desc);

-- Active bookings (draft/new/submitted), fuzzy + browse (empty q returns recent active)
create or replace function public.tms_search_bookings(q text default '')
returns table(id uuid, booking_ref text, module text, consignee_name text, sim real)
language sql stable as $$
  select b.id, b.booking_ref, b.module, b.consignee_name,
         greatest(similarity(coalesce(b.booking_ref,''), q), similarity(coalesce(b.consignee_name,''), q))::real as sim
  from public.bookings b
  where b.status in ('draft','new','submitted')
    and (q = '' or b.booking_ref ilike '%'||q||'%' or b.consignee_name ilike '%'||q||'%'
         or similarity(coalesce(b.booking_ref,''), q) > 0.2)
  order by case when q = '' then 0
                else greatest(similarity(coalesce(b.booking_ref,''), q), similarity(coalesce(b.consignee_name,''), q)) end desc,
           b.created_at desc
  limit 12
$$;
grant execute on function public.tms_search_bookings(text) to authenticated;

-- Active (recent 120d) shipments, fuzzy + browse
create or replace function public.tms_search_shipments(q text default '')
returns table(job_unique bigint, house_bill text, master_bill text, shipper_name text, consignee_name text, module text, relevant_date date, sim real)
language sql stable as $$
  select s.job_unique, s.house_bill, s.master_bill, s.shipper_name, s.consignee_name, s.module, s.relevant_date,
         greatest(similarity(coalesce(s.house_bill,''), q), similarity(coalesce(s.master_bill,''), q), similarity(s.job_unique::text, q))::real as sim
  from public.shipments s
  where s.relevant_date >= (current_date - interval '120 days')
    and (q = '' or s.house_bill ilike '%'||q||'%' or s.master_bill ilike '%'||q||'%'
         or s.job_unique::text like q||'%' or similarity(coalesce(s.house_bill,''), q) > 0.25)
  order by case when q = '' then 0
                else greatest(similarity(coalesce(s.house_bill,''), q), similarity(coalesce(s.master_bill,''), q), similarity(s.job_unique::text, q)) end desc,
           s.relevant_date desc
  limit 12
$$;
grant execute on function public.tms_search_shipments(text) to authenticated;
notify pgrst, 'reload schema';

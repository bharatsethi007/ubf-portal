-- Portal invoice PDF (applied via Supabase MCP 30 Sep 2026; repo parity, do not re-run).
-- portal_invoice_detail: adds gst_code per line; if reversal lines break the total, uses the original positive lines when those tie out.
-- portal_invoice_document: header, bill-to, shipment block and containers for the duplicate invoice PDF.

create or replace function public.portal_invoice_detail(p_invoice_no text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with inv as (
    select i.*, coalesce(nullif(i.exch_rate, 0), 1) fx, round(i.tax_amount * coalesce(nullif(i.exch_rate, 0), 1), 2) gst_fx
      from public.invoices i
     where i.invoice_no = p_invoice_no and i.account_id = public.my_account_id()
  ),
  ln as (
    select j.line_no, j.charge_code, j.description, j.gst_code, coalesce(j.gst_rate, 0) gst_rate,
           round(j.sell * inv.fx, 2) amount, round(j.sell * inv.fx * coalesce(j.gst_rate, 0) / 100, 2) gst
      from public.job_charges j join inv on j.invoice_no = inv.invoice_no and j.job_unique = inv.job_unique
     where coalesce(j.sell, 0) <> 0
  ),
  pick as (
    select case
      when abs(coalesce((select sum(amount) from ln), 0) + inv.gst_fx - coalesce(inv.amt_foreign, inv.amt_local)) < 0.5 then 'all'
      when abs(coalesce((select sum(amount) from ln where amount > 0), 0) + inv.gst_fx - coalesce(inv.amt_foreign, inv.amt_local)) < 0.5 then 'pos'
      else 'all' end mode,
      abs(coalesce((select sum(amount) from ln), 0) + inv.gst_fx - coalesce(inv.amt_foreign, inv.amt_local)) < 0.5
        or abs(coalesce((select sum(amount) from ln where amount > 0), 0) + inv.gst_fx - coalesce(inv.amt_foreign, inv.amt_local)) < 0.5 as itemised
    from inv
  )
  select jsonb_build_object(
    'invoice_no', inv.invoice_no,
    'total', coalesce(inv.amt_foreign, inv.amt_local),
    'gst', inv.gst_fx,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('code', charge_code, 'description', description, 'amount', amount,
                                                            'gst_rate', gst_rate, 'gst', gst, 'gst_code', gst_code) order by line_no)
                         from ln where pick.mode = 'all' or ln.amount > 0), '[]'::jsonb),
    'itemised', pick.itemised
  )
  from inv, pick
$$;

create or replace function public.portal_invoice_document(p_invoice_no text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'invoice_no', i.invoice_no, 'doctype', i.doctype, 'doc_date', i.doc_date, 'date_due', coalesce(i.date_due, i.doc_date + 30),
    'currency', coalesce(i.currency, 'NZD'), 'total', coalesce(i.amt_foreign, i.amt_local),
    'gst', round(i.tax_amount * coalesce(nullif(i.exch_rate, 0), 1), 2), 'comment', i.comment,
    'account_id', c.account_id, 'bill_name', c.name,
    'bill_address', array_remove(array[nullif(trim(c.address1), ''), nullif(trim(c.address2), ''), nullif(trim(c.address3), ''),
      nullif(trim(concat_ws(' ', c.city, c.postcode, case when c.country = 'NZ' then 'New Zealand' else c.country end)), '')], null),
    'our_ref', case when s.job_unique is null then null
      else coalesce(case left(s.module, 3) when 'FIS' then 'Import Sea' when 'FIA' then 'Import Air' when 'FES' then 'Export Sea' when 'FEA' then 'Export Air' end, s.module)
           || ' ' || coalesce(s.shipment_no::text, '') || ' / ' || coalesce(s.job_no, 1) end,
    'customer_ref', s.customer_ref, 'goods', s.goods_desc, 'vessel', s.vessel_flight,
    'packages', nullif(trim(concat_ws(' ',
       case when s.pack_qty is not null then trim(to_char(s.pack_qty, 'FM999,999,990.##'), '.') || ' ' || coalesce(s.pack_type, '') end,
       case when s.weight_kg is not null then trim(to_char(s.weight_kg, 'FM999,999,990.##'), '.') || ' KG' end,
       case when s.volume_m3 is not null then to_char(s.volume_m3, 'FM999,990.000') || ' M3' end)), ''),
    'origin', coalesce(po.name, s.origin), 'destination', coalesce(pd.name, s.final_dest, s.destination),
    'consignee', s.consignee_name, 'shipper', s.shipper_name, 'ocean_bill', s.master_bill, 'house_bill', s.house_bill,
    'mode', s.mode, 'load_type', s.load_type, 'etd', s.etd, 'eta', s.eta,
    'containers', coalesce(
      (select jsonb_agg(k.c_number || coalesce(' (' || k.container_size || ')', '') order by k.c_number)
         from public.containers k where k.job_unique = i.job_unique and k.c_number is not null),
      (select jsonb_agg(k.c_number || coalesce(' (' || k.container_size || ')', '') order by k.c_number)
         from public.containers k
        where s.consol_key is not null and k.consol_key = s.consol_key and k.c_number is not null
          and (select count(*) from public.shipments x where x.consol_key = s.consol_key) = 1),
      '[]'::jsonb)
  )
  from public.invoices i
  left join public.customers c on c.account_id = i.account_id
  left join public.shipments s on s.job_unique = i.job_unique
  left join public.ports po on po.code = s.origin
  left join public.ports pd on pd.code = s.destination
  where i.invoice_no = p_invoice_no and i.account_id = public.my_account_id()
$$;

revoke all on function public.portal_invoice_document(text) from public, anon;
grant execute on function public.portal_invoice_document(text) to authenticated;
notify pgrst, 'reload schema';

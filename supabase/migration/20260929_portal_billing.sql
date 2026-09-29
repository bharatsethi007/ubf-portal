-- Customer portal billing.
--   * portal_invoices: add invoice-currency amounts. amt_local / balance are NZD (ERP ledger);
--     amt_foreign is what the customer was billed in `currency`. amount_due = balance in invoice currency.
--   * portal_billing(p_months): invoices with shipment number, route and refs, for the Billing page.
--   * portal_invoice_detail(p_invoice_no): charge lines for one of the customer's own invoices.
--     Customer-safe columns only: description, amount, GST. Never cost / profit / buy side.
-- Idempotent.

create or replace view public.portal_invoices as
 select invoice_no, doctype, module, job_unique, doc_date, date_due, amt_local, balance, tax_amount, currency,
        coalesce(amt_foreign, amt_local) as amt_foreign,
        coalesce(nullif(exch_rate, 0), 1) as exch_rate,
        round(balance * coalesce(nullif(exch_rate, 0), 1), 2) as amount_due
   from public.invoices i
  where account_id = public.my_account_id();
grant select on public.portal_invoices to authenticated;

create or replace function public.portal_billing(p_months int default 24)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'invoice_no', i.invoice_no, 'doctype', i.doctype, 'module', i.module, 'job_unique', i.job_unique,
      'doc_date', i.doc_date, 'date_due', coalesce(i.date_due, i.doc_date + 30),
      'currency', coalesce(i.currency, 'NZD'), 'fx', coalesce(nullif(i.exch_rate, 0), 1),
      'amount', coalesce(i.amt_foreign, i.amt_local), 'amount_nzd', i.amt_local,
      'due', round(i.balance * coalesce(nullif(i.exch_rate, 0), 1), 2), 'due_nzd', i.balance,
      'gst', round(i.tax_amount * coalesce(nullif(i.exch_rate, 0), 1), 2),
      'shipment_no', case when s.module like 'FI%' and s.shipment_no is not null
                            then s.module || '-' || s.shipment_no || case when coalesce(s.job_no, 1) > 1 then '/' || s.job_no else '' end
                          else coalesce(s.job_no::text, s.house_bill) end,
      'customer_ref', s.customer_ref, 'origin', s.origin, 'destination', s.destination, 'mode', s.mode,
      'direction', s.direction, 'party', case when s.direction = 'export' then s.consignee_name else s.shipper_name end,
      'house_bill', s.house_bill
    ) order by i.doc_date desc, i.invoice_no desc), '[]'::jsonb)
    from public.invoices i
    left join public.portal_shipments s on s.job_unique = i.job_unique
   where i.account_id = public.my_account_id()
     and (i.balance <> 0 or i.doc_date >= current_date - make_interval(months => greatest(1, least(coalesce(p_months, 24), 120))))
$$;
revoke all on function public.portal_billing(int) from public, anon;
grant execute on function public.portal_billing(int) to authenticated;

create or replace function public.portal_invoice_detail(p_invoice_no text)
returns jsonb
language sql stable security definer set search_path = public as $$
  with inv as (
    select i.*, coalesce(nullif(i.exch_rate, 0), 1) fx
      from public.invoices i
     where i.invoice_no = p_invoice_no and i.account_id = public.my_account_id()
  ),
  ln as (
    select j.line_no, j.charge_code, j.description, j.gst_code, coalesce(j.gst_rate, 0) gst_rate,
           round(j.sell * inv.fx, 2) amount, round(j.sell * inv.fx * coalesce(j.gst_rate, 0) / 100, 2) gst
      from public.job_charges j join inv on j.invoice_no = inv.invoice_no and j.job_unique = inv.job_unique
     where coalesce(j.sell, 0) <> 0
  )
  select jsonb_build_object(
    'invoice_no', inv.invoice_no,
    'total', coalesce(inv.amt_foreign, inv.amt_local),
    'gst', round(inv.tax_amount * inv.fx, 2),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('code', charge_code, 'description', description, 'amount', amount,
                                                            'gst_rate', gst_rate, 'gst', gst) order by line_no) from ln), '[]'::jsonb),
    -- ERP lines can drift from the posted invoice (edits after invoicing). Flag it rather than show a wrong breakdown silently.
    'itemised', abs(coalesce((select sum(amount) from ln), 0) + round(inv.tax_amount * inv.fx, 2) - coalesce(inv.amt_foreign, inv.amt_local)) < 0.5
  )
  from inv
$$;
revoke all on function public.portal_invoice_detail(text) from public, anon;
grant execute on function public.portal_invoice_detail(text) to authenticated;

notify pgrst, 'reload schema';

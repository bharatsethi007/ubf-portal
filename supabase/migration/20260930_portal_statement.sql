-- Portal statement PDF (applied via Supabase MCP 30 Sep 2026; repo parity, do not re-run).
-- Bill-to header and every open item for the signed-in account, NZD ledger values.
create or replace function public.portal_statement()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'account_id', c.account_id, 'bill_name', c.name,
    'bill_address', array_remove(array[nullif(trim(c.address1), ''), nullif(trim(c.address2), ''), nullif(trim(c.address3), ''),
      nullif(trim(concat_ws(' ', c.city, c.postcode)), ''), case when c.country = 'NZ' then 'New Zealand' else nullif(c.country, '') end], null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'invoice_no', i.invoice_no, 'doctype', i.doctype, 'doc_date', i.doc_date, 'date_due', coalesce(i.date_due, i.doc_date + 30),
          'our_ref', case when s.job_unique is null then null
                          else coalesce(nullif(right(s.module, 2), ''), s.module) || ' ' || coalesce(s.shipment_no::text, '') || '/' || coalesce(s.job_no, 1) end,
          'your_ref', s.customer_ref, 'amount', i.amt_local, 'balance', i.balance, 'currency', coalesce(i.currency, 'NZD'))
        order by i.doc_date, i.invoice_no)
        from public.invoices i
        left join public.shipments s on s.job_unique = i.job_unique
       where i.account_id = c.account_id and i.balance <> 0), '[]'::jsonb)
  )
  from public.customers c
  where c.account_id = public.my_account_id()
$$;
revoke all on function public.portal_statement() from public, anon;
grant execute on function public.portal_statement() to authenticated;
notify pgrst, 'reload schema';

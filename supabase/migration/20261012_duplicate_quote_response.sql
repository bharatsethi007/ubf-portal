-- APPLIED 12 Oct 2026 via MCP. DO NOT RE-RUN.
-- Copies a quote response (header + charge lines) as a new draft. response_no comes from trg_gen_response_no.
create or replace function public.duplicate_quote_response(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_new uuid;
begin
  if not is_staff() then raise exception 'forbidden'; end if;

  insert into quote_responses (
    quote_id, status, quotation_date, valid_from, valid_till, etd, eta, carrier, via_port,
    transit_time_days, transit_time, origin_free_time_days, detention_free_time_dest, product,
    currency, exchange_rate, include_payment_link, enable_fixed_items, customer_notes, terms_conditions,
    sub_total, total_sell, total_tax, total_buy, net_profit, margin_pct, created_by)
  select quote_id, 'draft', current_date, valid_from, valid_till, etd, eta, carrier, via_port,
    transit_time_days, transit_time, origin_free_time_days, detention_free_time_dest, product,
    currency, exchange_rate, include_payment_link, enable_fixed_items, customer_notes, terms_conditions,
    sub_total, total_sell, total_tax, total_buy, net_profit, margin_pct, auth.uid()
  from quote_responses where id = p_id
  returning id into v_new;

  if v_new is null then raise exception 'response not found'; end if;

  insert into quote_response_lines (
    response_id, ord, description, is_service_charge, vendor, unit, qty, buy_currency, sell_currency,
    min_buy, min_sell, buy_rate, sell_rate, tax, ex_rate_buy, ex_rate_sell, total_buy, total_sell, charge_group)
  select v_new, ord, description, is_service_charge, vendor, unit, qty, buy_currency, sell_currency,
    min_buy, min_sell, buy_rate, sell_rate, tax, ex_rate_buy, ex_rate_sell, total_buy, total_sell, charge_group
  from quote_response_lines where response_id = p_id;

  return v_new;
end $$;

grant execute on function public.duplicate_quote_response(uuid) to authenticated;
notify pgrst, 'reload schema';

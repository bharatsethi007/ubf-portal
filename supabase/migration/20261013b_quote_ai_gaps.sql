-- UBF Intelligence follow-up: carrier stored as shipping line name, and gaps
-- (missing origin / destination charges, buy rate not on file) recorded on the quote for the list tooltip.

alter table public.quotes add column if not exists ai_gaps text[];

create or replace function public.quote_response_gaps(p_resp uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when not exists (select 1 from public.quote_response_lines where response_id = p_resp and charge_group = 'origin')
         then 'Origin charges missing' end,
    case when not exists (select 1 from public.quote_response_lines where response_id = p_resp and charge_group in ('dest', 'destination'))
         then 'Destination charges missing' end,
    case when exists (select 1 from public.quote_response_lines where response_id = p_resp
                       and coalesce(sell_rate, 0) > 0 and coalesce(buy_rate, 0) = 0)
         then 'Buy rate not on file' end
  ], null)
$$;
revoke all on function public.quote_response_gaps(uuid) from public, anon, authenticated;

create or replace function public.quote_auto_price(p_quote uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q public.quotes;
  md text; lt text; ctr text; n int;
  kg numeric; cbm numeric; ch numeric; wm numeric;
  o jsonb; best jsonb; best_key numeric[]; k numeric[]; tot numeric; rate numeric;
  line_id uuid; card uuid; v_resp uuid; ord int := 0;
  b_rate numeric; b_min numeric; s_rate numeric; s_min numeric; qty numeric; unit text; descr text;
  cur text; s record; v_carrier text; v_gaps text[];
begin
  select * into q from public.quotes where id = p_quote;
  if q.id is null or q.from_port_code is null or q.to_port_code is null then return null; end if;
  if exists (select 1 from public.quote_responses where quote_id = p_quote) then return null; end if;

  md := case when lower(coalesce(q.shipment_mode, '')) like '%air%' or upper(coalesce(q.shipment_type, '')) = 'AIR' then 'air' else 'sea' end;
  lt := case when md = 'air' then null else coalesce(nullif(upper(q.shipment_type), ''), 'FCL') end;
  ctr := nullif(upper(q.source_meta->>'container_type'), '');
  n := greatest(coalesce(nullif(q.source_meta->>'container_count', '')::int, 1), 1);
  select coalesce(sum(coalesce(gross_wt, total_weight)), 0), coalesce(sum(coalesce(volume_cbm, total_cbm)), 0)
    into kg, cbm from public.quote_cargo_lines where quote_id = p_quote;
  ch := greatest(kg, cbm * 167);
  wm := greatest(cbm, kg / 1000.0, 1);

  for o in select * from jsonb_array_elements(public.portal_rate_options(q.customer_account_id, q.from_port_code, q.to_port_code, md, lt, ctr, null)) loop
    continue when o->>'sell' is null;
    if o->>'product' = 'FCL' then
      tot := (o->>'sell')::numeric * n;
    elsif o->>'product' = 'LCL' then
      tot := greatest((o->>'sell')::numeric * wm, coalesce((o->>'sell_min')::numeric, 0));
    else
      rate := public.air_break_rate((o->'breaks'->>'n')::numeric, (o->'breaks'->>'45')::numeric, (o->'breaks'->>'100')::numeric,
                                    (o->'breaks'->>'250')::numeric, (o->'breaks'->>'500')::numeric, (o->'breaks'->>'1000')::numeric, ch);
      tot := greatest(coalesce(rate, (o->>'sell')::numeric) * ch, coalesce((o->>'sell_min')::numeric, 0));
    end if;
    k := array[case when (o->>'contract')::boolean then 0 else 1 end, tot, coalesce((o->>'transit_days')::numeric, 9999)];
    if best is null or k < best_key then best := o; best_key := k; end if;
  end loop;
  if best is null then return null; end if;

  line_id := split_part(best->>'ref', ':', 2)::uuid;
  cur := coalesce(best->>'currency', 'NZD');
  s_min := (best->>'sell_min')::numeric;
  b_min := null;

  if best->>'product' = 'FCL' then
    select l.base_rate, l.rate_card_id into b_rate, card from public.rate_card_fcl_lines l where l.id = line_id;
    s_rate := (best->>'sell')::numeric; qty := n; unit := 'Per container';
    descr := 'Ocean freight ' || coalesce(best->>'container_type', '');
    ctr := best->>'container_type';
  elsif best->>'product' = 'LCL' then
    select l.rate_per_wm, l.min_charge, l.rate_card_id into b_rate, b_min, card from public.rate_card_lcl_lines l where l.id = line_id;
    s_rate := (best->>'sell')::numeric; qty := wm; unit := 'Per W/M'; descr := 'Ocean freight LCL';
  else
    select public.air_break_rate(l.rate_n, l.rate_45, l.rate_100, l.rate_250, l.rate_500, l.rate_1000, ch), l.min_charge, l.rate_card_id
      into b_rate, b_min, card from public.rate_card_air_lines l where l.id = line_id;
    s_rate := coalesce(public.air_break_rate((best->'breaks'->>'n')::numeric, (best->'breaks'->>'45')::numeric, (best->'breaks'->>'100')::numeric,
                       (best->'breaks'->>'250')::numeric, (best->'breaks'->>'500')::numeric, (best->'breaks'->>'1000')::numeric, ch), (best->>'sell')::numeric);
    qty := ch; unit := 'Per kg'; descr := 'Air freight';
  end if;

  -- Store the carrier as the shipping line name so the editor's Shipping Line select matches.
  v_carrier := coalesce((select sl.name from public.shipping_lines sl
                          where upper(sl.code) = upper(best->>'carrier') or upper(sl.name) = upper(best->>'carrier')
                          order by (upper(sl.code) = upper(best->>'carrier')) desc limit 1), best->>'carrier');

  insert into public.quote_responses (quote_id, status, quotation_date, valid_from, valid_till, carrier, via_port,
                                      transit_time_days, currency, ai_generated, customer_notes)
  values (p_quote, 'draft', current_date, current_date,
          least(coalesce((best->>'valid_to')::date, current_date + 30), current_date + 30),
          v_carrier, best->>'via', (best->>'transit_days')::int, cur, true,
          'Freight only. Origin and destination charges not included.')
  returning id into v_resp;

  insert into public.quote_response_lines (response_id, ord, description, charge_group, vendor, unit, qty,
         buy_currency, sell_currency, buy_rate, sell_rate, min_buy, min_sell, tax, total_buy, total_sell)
  values (v_resp, ord, trim(descr), 'freight', best->>'carrier', unit, round(qty, 3), cur, cur, b_rate, s_rate, b_min, s_min, 'no_tax',
          round(greatest(coalesce(b_rate, 0) * qty, coalesce(b_min, 0)), 2), round(greatest(s_rate * qty, coalesce(s_min, 0)), 2));

  for s in
    select x.* from public.rate_surcharges x
     where x.rate_card_id = card and x.sell_amount is not null and coalesce(x.basis, '') <> 'percent'
       and (x.valid_to is null or x.valid_to >= current_date)
       and (x.container_type is null or x.container_type = ctr)
     order by case x.scope when 'origin' then 1 when 'freight' then 0 else 2 end, x.label
  loop
    ord := ord + 1;
    qty := case s.basis when 'per_container' then n when 'per_teu' then n * case when ctr like '40%' then 2 else 1 end
                        when 'per_kg' then ch when 'per_wm' then wm when 'per_cbm' then greatest(cbm, 1) else 1 end;
    unit := case s.basis when 'per_container' then 'Per container' when 'per_teu' then 'Per TEU' when 'per_kg' then 'Per kg'
                         when 'per_wm' then 'Per W/M' when 'per_cbm' then 'Per CBM' when 'per_bl' then 'Per B/L'
                         when 'per_awb' then 'Per AWB' else 'Flat' end;
    insert into public.quote_response_lines (response_id, ord, description, charge_group, vendor, unit, qty,
           buy_currency, sell_currency, buy_rate, sell_rate, min_buy, min_sell, tax, total_buy, total_sell)
    values (v_resp, ord, s.label, case s.scope when 'origin' then 'origin' when 'dest' then 'destination' else 'freight' end,
            best->>'carrier', unit, round(qty, 3), coalesce(s.currency_code, cur), coalesce(s.currency_code, cur),
            s.amount, s.sell_amount, s.min_amount, null, 'no_tax',
            round(greatest(coalesce(s.amount, 0) * qty, coalesce(s.min_amount, 0)), 2), round(s.sell_amount * qty, 2));
  end loop;

  update public.quote_responses r set
         sub_total = t.sell, total_sell = t.sell, total_tax = 0, total_buy = t.buy, net_profit = t.sell - t.buy,
         margin_pct = case when t.sell > 0 then round((t.sell - t.buy) / t.sell * 100, 2) end
    from (select coalesce(sum(total_sell), 0) sell, coalesce(sum(total_buy), 0) buy
            from public.quote_response_lines where response_id = v_resp) t
   where r.id = v_resp;

  v_gaps := public.quote_response_gaps(v_resp);
  update public.quotes set ai_priced_at = now(), ai_gaps = v_gaps where id = p_quote;
  return v_resp;
end $$;

revoke all on function public.quote_auto_price(uuid) from public, anon, authenticated;

-- Backfill quotes already priced by UBF Intelligence.
update public.quote_responses r
   set carrier = sl.name
  from public.shipping_lines sl
 where r.ai_generated and upper(sl.code) = upper(r.carrier) and sl.name <> r.carrier;

update public.quotes q
   set ai_gaps = public.quote_response_gaps(r.id)
  from public.quote_responses r
 where r.quote_id = q.id and r.ai_generated and q.ai_priced_at is not null;

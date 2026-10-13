-- Quotes: "unsent" dot + UBF Intelligence auto-pricing of portal quote requests.
-- 1) quotes.sent_for_approval_at  = first time any option was sent for approval (kept by trigger).
-- 2) quotes.ai_priced_at          = UBF Intelligence created the first option.
-- 3) quote_responses.ai_generated = option built by quote_auto_price, not by staff.
-- 4) quote_auto_price(quote)      = picks contract-first, then cheapest total, then fastest
--                                   published rate and writes it as a draft option.
-- 5) portal_request_quote now sets movement_type and calls quote_auto_price.

alter table public.quotes
  add column if not exists sent_for_approval_at timestamptz,
  add column if not exists ai_priced_at timestamptz;
alter table public.quote_responses
  add column if not exists ai_generated boolean not null default false;

update public.quotes q set sent_for_approval_at = s.t
  from (select quote_id, min(sent_to_portal_at) t from public.quote_responses
         where sent_to_portal_at is not null group by quote_id) s
 where s.quote_id = q.id and q.sent_for_approval_at is null;

create or replace function public.quote_responses_mark_sent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.quotes set sent_for_approval_at = new.sent_to_portal_at
   where id = new.quote_id and sent_for_approval_at is null;
  return null;
end $$;

drop trigger if exists trg_quote_responses_mark_sent on public.quote_responses;
create trigger trg_quote_responses_mark_sent
  after insert or update of sent_to_portal_at on public.quote_responses
  for each row when (new.sent_to_portal_at is not null)
  execute function public.quote_responses_mark_sent();

-- Air break for a weight: highest break <= kg that has a value, else the lowest available.
create or replace function public.air_break_rate(p_n numeric, p45 numeric, p100 numeric, p250 numeric, p500 numeric, p1000 numeric, p_kg numeric)
returns numeric language sql immutable as $$
  select coalesce(
    (select r from (values (0, p_n), (45, p45), (100, p100), (250, p250), (500, p500), (1000, p1000)) b(t, r)
      where r is not null and t <= coalesce(p_kg, 0) order by t desc limit 1),
    (select r from (values (0, p_n), (45, p45), (100, p100), (250, p250), (500, p500), (1000, p1000)) b(t, r)
      where r is not null order by t limit 1))
$$;

create or replace function public.quote_auto_price(p_quote uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q public.quotes;
  md text; lt text; ctr text; n int;
  kg numeric; cbm numeric; ch numeric; wm numeric;
  o jsonb; best jsonb; best_key numeric[]; k numeric[]; tot numeric; rate numeric;
  line_id uuid; card uuid; v_resp uuid; ord int := 0;
  b_rate numeric; b_min numeric; s_rate numeric; s_min numeric; qty numeric; unit text; descr text;
  cur text; s record;
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

  insert into public.quote_responses (quote_id, status, quotation_date, valid_from, valid_till, carrier, via_port,
                                      transit_time_days, currency, ai_generated, customer_notes)
  values (p_quote, 'draft', current_date, current_date,
          least(coalesce((best->>'valid_to')::date, current_date + 30), current_date + 30),
          best->>'carrier', best->>'via', (best->>'transit_days')::int, cur, true,
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

  update public.quotes set ai_priced_at = now() where id = p_quote;
  return v_resp;
end $$;

revoke all on function public.quote_auto_price(uuid) from public, anon, authenticated;

create or replace function public.portal_request_quote(p jsonb)
 returns table(quote_id uuid, quote_no text)
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  acct text := public.portal_account_for('rates');
  md text := lower(coalesce(p->>'mode', ''));
  lt text := upper(nullif(p->>'load_type', ''));
  dir text := lower(nullif(p->>'direction', ''));
  v_id uuid;
  v_no text;
  v_name text;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if md not in ('sea', 'air') then raise exception 'Choose sea or air'; end if;
  if coalesce(trim(p->>'origin'), '') = '' or coalesce(trim(p->>'destination'), '') = '' then
    raise exception 'Origin and destination are required';
  end if;
  select name into v_name from public.customers where account_id = acct;

  insert into public.quotes (
    status, source, source_meta, shipment_mode, shipment_type, movement_type, customer_account_id, customer_name,
    from_port_code, to_port_code, pickup_date, is_hazardous, need_refrigeration, external_notes, customer_po, created_by
  ) values (
    'open', 'customer_portal',
    jsonb_build_object('requested_by', auth.uid(), 'container_type', nullif(p->>'container_type', ''),
                       'container_count', nullif(p->>'container_count', ''), 'direction', dir),
    md, case when md = 'air' then 'Air' else coalesce(lt, 'FCL') end,
    case when dir in ('import', 'export') then dir end, acct, v_name,
    upper(trim(p->>'origin')), upper(trim(p->>'destination')), nullif(p->>'cargo_ready_date', '')::date,
    coalesce((p->>'is_dg')::boolean, false), coalesce((p->>'is_temp_controlled')::boolean, false),
    nullif(trim(p->>'notes'), ''), nullif(trim(p->>'customer_ref'), ''), null
  ) returning id, quotes.quote_no into v_id, v_no;

  if coalesce(trim(p->>'goods_description'), '') <> '' or nullif(p->>'weight_kg', '') is not null or nullif(p->>'cbm', '') is not null then
    insert into public.quote_cargo_lines (quote_id, ord, cargo_description, packages, gross_wt, volume_cbm)
    values (v_id, 1, nullif(trim(p->>'goods_description'), ''), nullif(p->>'pieces', '')::numeric,
            nullif(p->>'weight_kg', '')::numeric, nullif(p->>'cbm', '')::numeric);
  end if;

  -- UBF Intelligence: draft the best published rate. Never blocks the request.
  begin
    perform public.quote_auto_price(v_id);
  exception when others then
    raise warning 'quote_auto_price %: %', v_id, sqlerrm;
  end;

  perform public.portal_booking_notify_queue(v_id, 'quote_request');
  return query select v_id, v_no;
end $function$;

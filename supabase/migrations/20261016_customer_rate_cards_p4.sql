-- Customer rates phase 4: turn one or more Setup cards shared with a customer into a customer rate card (proposal).
-- Sell per line = line sell > line margin > card margin, as the rate engine prices that card today.

create or replace function customer_rate_card_from_setup(p_cards uuid[], p_account text, p_from date, p_to date, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid; v_email text; v_cur text; n int := 0; v_refs text;
begin
  if not has_perm('customer_rates', 'add') then raise exception 'Not allowed'; end if;
  if coalesce(array_length(p_cards, 1), 0) = 0 then raise exception 'Pick at least one card'; end if;
  if p_account is null or not exists (select 1 from customers where account_id = p_account) then raise exception 'Pick a customer'; end if;
  if p_to < p_from then raise exception 'Valid to must be after valid from'; end if;

  select string_agg(coalesce(title, id::text), ', ') into v_refs from rate_cards where id = any (p_cards);
  insert into customer_rate_cards (account_id, title, status, valid_from, valid_to, presentation, sales_id, pricing_id, created_by)
  values (p_account, coalesce(nullif(trim(p_title), ''), ''), 'draft', p_from, p_to, 'both', auth.uid(), auth.uid(), auth.uid())
  returning id into v_new;

  insert into customer_rate_card_lines (card_id, sort, product, origin_code, dest_code, container_type, carrier, transit_days, via, frequency,
    source_table, source_line_id, source_card_id, buy, buy_currency, margin_method, margin_value, freight_sell, sell_min, sell_currency,
    origin_currency, dest_currency, show)
  select v_new, row_number() over (order by x.product, x.origin, x.dest, x.ctr) - 1, x.product, x.origin, x.dest, x.ctr, x.vendor,
         x.transit_days, x.via, x.frequency, x.src, x.line_id, x.card_id, x.buy, x.cur,
         case when x.sell is null then 'rule' else 'sell' end, null, round(x.sell, 2), x.sell_min, coalesce(x.cur, 'USD'),
         coalesce(x.cur, 'USD'), 'NZD', true
  from (
    select 'FCL' as product, 'fcl' as src, f.id as line_id, rc.id as card_id, coalesce(f.origin_port_code, f.origin_group_code) as origin,
           f.dest_port_code as dest, f.container_type as ctr, coalesce(rc.vendor_name, rc.shipping_line_code) as vendor,
           f.transit_days, f.via, null::text as frequency, f.base_rate as buy, coalesce(f.currency_code, rc.currency_code) as cur, null::numeric as sell_min,
           coalesce(f.sell_rate,
             case when f.margin_value is not null then case when f.margin_type = 'fixed' then f.base_rate + f.margin_value else f.base_rate * (1 + f.margin_value / 100) end end,
             case when rc.default_margin_type = 'fixed' and rc.default_margin_fixed is not null then f.base_rate + rc.default_margin_fixed end,
             case when rc.default_markup_pct is not null then f.base_rate * (1 + rc.default_markup_pct / 100) end) as sell
    from rate_card_fcl_lines f join rate_cards rc on rc.id = f.rate_card_id where rc.id = any (p_cards) and f.base_rate is not null
    union all
    select 'LCL', 'lcl', x.id, rc.id, coalesce(x.origin_port_code, x.origin_group_code), x.dest_port_code, null, coalesce(rc.vendor_name, rc.co_loader_code),
           x.transit_days, x.via, x.frequency, x.rate_per_wm, coalesce(x.currency_code, rc.currency_code), x.sell_min,
           coalesce(x.sell_per_wm,
             case when x.margin_value is not null then case when x.margin_type = 'fixed' then x.rate_per_wm + x.margin_value else x.rate_per_wm * (1 + x.margin_value / 100) end end,
             case when rc.default_margin_type = 'fixed' and rc.default_margin_fixed is not null then x.rate_per_wm + rc.default_margin_fixed end,
             case when rc.default_markup_pct is not null then x.rate_per_wm * (1 + rc.default_markup_pct / 100) end)
    from rate_card_lcl_lines x join rate_cards rc on rc.id = x.rate_card_id where rc.id = any (p_cards) and x.rate_per_wm is not null
    union all
    select 'AIR', 'air', a.id, rc.id, coalesce(a.origin_port_code, a.origin_group_code), a.dest_port_code, null, coalesce(rc.vendor_name, rc.shipping_line_code),
           a.transit_days, a.via, a.frequency, a.rate_100, coalesce(a.currency_code, rc.currency_code), null,
           coalesce(
             case when a.margin_value is not null then case when a.margin_type = 'fixed' then a.rate_100 + a.margin_value else a.rate_100 * (1 + a.margin_value / 100) end end,
             case when a.markup_pct is not null then a.rate_100 * (1 + a.markup_pct / 100) end,
             case when rc.default_margin_type = 'fixed' and rc.default_margin_fixed is not null then a.rate_100 + rc.default_margin_fixed end,
             case when rc.default_markup_pct is not null then a.rate_100 * (1 + rc.default_markup_pct / 100) end)
    from rate_card_air_lines a join rate_cards rc on rc.id = a.rate_card_id where rc.id = any (p_cards) and a.rate_100 is not null
  ) x
  where x.origin is not null and x.dest is not null;
  get diagnostics n = row_count;

  select email into v_email from staff_users where user_id = auth.uid();
  insert into customer_rate_card_events (card_id, kind, actor, detail)
  values (v_new, 'from_setup', v_email, jsonb_build_object('cards', p_cards, 'titles', v_refs, 'lanes', n));
  return v_new;
end $$;
grant execute on function customer_rate_card_from_setup(uuid[], text, date, date, text) to authenticated;

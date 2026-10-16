-- Customer rates phase 3: copy a rate card, shared Setup cards in the list, search all valid carrier rates.

-- Copy any rate card into a new draft, for the same or another customer, with new dates.
create or replace function customer_rate_card_copy(p_id uuid, p_account text, p_from date, p_to date, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c customer_rate_cards; v_new uuid; v_email text;
begin
  if not has_perm('customer_rates', 'add') then raise exception 'Not allowed'; end if;
  select * into c from customer_rate_cards where id = p_id;
  if c.id is null then raise exception 'Rate card not found'; end if;
  if p_to < p_from then raise exception 'Valid to must be after valid from'; end if;
  insert into customer_rate_cards (account_id, title, status, valid_from, valid_to, presentation, fx, sales_id, pricing_id, included, excluded, terms, created_by)
  values (coalesce(nullif(p_account, ''), c.account_id), coalesce(nullif(trim(p_title), ''), c.title), 'draft', p_from, p_to,
          c.presentation, c.fx, c.sales_id, c.pricing_id, c.included, c.excluded, c.terms, auth.uid())
  returning id into v_new;
  insert into customer_rate_card_lines (card_id, sort, product, origin_code, dest_code, container_type, carrier, transit_days, via, frequency,
    source_table, source_line_id, source_card_id, buy, buy_currency, margin_method, margin_value, freight_sell, sell_min, sell_currency,
    origin_sell, origin_currency, dest_sell, dest_currency, show, notes)
  select v_new, sort, product, origin_code, dest_code, container_type, carrier, transit_days, via, frequency,
    source_table, source_line_id, source_card_id, buy, buy_currency, margin_method, margin_value, freight_sell, sell_min, sell_currency,
    origin_sell, origin_currency, dest_sell, dest_currency, show, notes
  from customer_rate_card_lines where card_id = p_id;
  select email into v_email from staff_users where user_id = auth.uid();
  insert into customer_rate_card_events (card_id, kind, actor, detail)
  values (v_new, 'copied_from', v_email, jsonb_build_object('from', c.ref, 'version', c.version, 'account', c.account_id));
  return v_new;
end $$;
grant execute on function customer_rate_card_copy(uuid, text, date, date, text) to authenticated;

-- Setup carrier cards shared with named customers, for Quotes > Customer rates.
create or replace function customer_rate_shared_cards()
returns table (id uuid, rate_type text, title text, vendor text, status text, valid_from date, valid_to date, lanes int,
               account_ids text[], customers text[])
language sql stable security definer set search_path = public as $$
  select rc.id, rc.rate_type, rc.title, coalesce(rc.vendor_name, rc.shipping_line_code, rc.co_loader_code), rc.status, rc.valid_from, rc.valid_to,
         (case rc.rate_type
            when 'fcl' then (select count(*) from rate_card_fcl_lines x where x.rate_card_id = rc.id)
            when 'lcl' then (select count(*) from rate_card_lcl_lines x where x.rate_card_id = rc.id)
            when 'air' then (select count(*) from rate_card_air_lines x where x.rate_card_id = rc.id) else 0 end)::int,
         array_agg(rcc.account_id order by cu.name), array_agg(coalesce(cu.name, rcc.account_id) order by cu.name)
  from rate_cards rc
  join rate_card_customers rcc on rcc.rate_card_id = rc.id
  left join customers cu on cu.account_id = rcc.account_id
  where is_staff() and rc.status <> 'archived'
  group by rc.id
  order by rc.valid_to desc nulls last
  limit 500
$$;
grant execute on function customer_rate_shared_cards() to authenticated;

-- Valid carrier rates only (status active or validated, started, not expired). Origin and destination optional.
create or replace function customer_rate_candidates(p_product text, p_origin text, p_dest text, p_container text)
returns table (
  source_table text, line_id uuid, card_id uuid, card_title text, vendor text, card_valid_to date,
  origin_code text, dest_code text, container_type text, buy numeric, buy_min numeric, currency text,
  transit_days int, via text, frequency text
)
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Pacific/Auckland')::date as d),
  cards as (
    select rc.* from rate_cards rc, today
    where rc.status in ('active', 'validated') and rc.rate_type = lower(p_product)
      and (rc.valid_from is null or rc.valid_from <= today.d) and (rc.valid_to is null or rc.valid_to >= today.d)
  )
  select * from (
    select 'fcl', f.id, rc.id, rc.title, coalesce(rc.vendor_name, rc.shipping_line_code), rc.valid_to,
           coalesce(f.origin_port_code, f.origin_group_code), f.dest_port_code, f.container_type, f.base_rate, null::numeric,
           coalesce(f.currency_code, rc.currency_code), f.transit_days, f.via, null::text
    from rate_card_fcl_lines f join cards rc on rc.id = f.rate_card_id, today
    where (f.valid_from is null or f.valid_from <= today.d) and (f.valid_to is null or f.valid_to >= today.d)
    union all
    select 'lcl', x.id, rc.id, rc.title, coalesce(rc.vendor_name, rc.co_loader_code), rc.valid_to,
           coalesce(x.origin_port_code, x.origin_group_code), x.dest_port_code, null, x.rate_per_wm, x.min_charge,
           coalesce(x.currency_code, rc.currency_code), x.transit_days, x.via, x.frequency
    from rate_card_lcl_lines x join cards rc on rc.id = x.rate_card_id, today
    where (x.valid_from is null or x.valid_from <= today.d) and (x.valid_to is null or x.valid_to >= today.d)
    union all
    select 'air', a.id, rc.id, rc.title, coalesce(rc.vendor_name, rc.shipping_line_code), rc.valid_to,
           coalesce(a.origin_port_code, a.origin_group_code), a.dest_port_code, null, a.rate_100, a.min_charge,
           coalesce(a.currency_code, rc.currency_code), a.transit_days, a.via, a.frequency
    from rate_card_air_lines a join cards rc on rc.id = a.rate_card_id
  ) t (source_table, line_id, card_id, card_title, vendor, card_valid_to, origin_code, dest_code, container_type, buy, buy_min, currency, transit_days, via, frequency)
  where is_staff()
    and t.buy is not null and t.buy > 0
    and (coalesce(p_dest, '') = '' or t.dest_code = upper(p_dest))
    and (coalesce(p_origin, '') = '' or t.origin_code = upper(p_origin))
    and (coalesce(p_container, '') = '' or t.container_type = upper(p_container))
  order by t.origin_code, t.dest_code, t.container_type nulls first, t.buy
  limit 5000
$$;

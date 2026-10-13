-- Customer pricing order. Idempotent. Run after 20261013_sell_only_pricing_fix.sql.
--   Specific beats general, theirs beats everyone's:
--   1. customer lane contract (rule with origin/dest/container/carrier)
--   2. the customer's own private rate card: its line sell, line margin, card margin
--   3. customer product-wide margin (e.g. +8% on buy)
--   4. public card: line sell, line margin, card margin
--   5. default margin
--   Sell-only lines (no buy): customer fixed contract, else the line sell.
--   staff_preview_customer_rates now also returns public_sell (what any other customer sees) per option.

drop function if exists public.rate_sell_ctx(numeric, text, text, text, text, text, text, text, text[], text, numeric, text, numeric, text, numeric, numeric);

create or replace function public.rate_sell_ctx(
  p_buy numeric, p_kind text, p_product text, p_account text,
  p_origin text, p_origin_group text, p_dest text, p_ctr text, p_carriers text[], p_currency text,
  p_line_sell numeric, p_line_mtype text, p_line_mval numeric,
  p_card_mtype text, p_card_pct numeric, p_card_fixed numeric, p_private boolean
) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  r public.rate_margin_rules;
  lane boolean := false;
  card_price numeric;
begin
  if p_account is not null then
    r := public.rate_rule_pick(p_product, p_account, p_origin, p_origin_group, p_dest, p_ctr, p_carriers, p_currency, p_kind = 'rate');
    lane := r.id is not null and (r.origin_code is not null or r.dest_code is not null or r.container_type is not null or r.carrier is not null);
  end if;

  if p_buy is null then
    if r.id is not null and r.method = 'fixed' then return round(r.value, 2); end if;
    return case when p_line_sell is null then null else round(p_line_sell, 2) end;
  end if;

  -- 1. customer lane contract
  if lane then return public.rate_rule_apply(p_buy, r); end if;

  -- price this card would give on its own (line sell > line margin > card margin)
  card_price := case
    when p_line_sell is not null then round(p_line_sell, 2)
    when p_line_mval is not null then round(case when p_line_mtype = 'fixed' then p_buy + p_line_mval else p_buy * (1 + p_line_mval / 100) end, 2)
    when p_card_mtype = 'fixed' and p_card_fixed is not null then round(p_buy + p_card_fixed, 2)
    when p_card_pct is not null then round(p_buy * (1 + p_card_pct / 100), 2)
  end;

  -- 2. their own private card
  if coalesce(p_private, false) and card_price is not null then return card_price; end if;
  -- 3. customer product-wide margin
  if r.id is not null then return public.rate_rule_apply(p_buy, r); end if;
  -- 4. public card
  if card_price is not null then return card_price; end if;
  -- 5. default margin
  r := public.rate_rule_pick(p_product, null, p_origin, p_origin_group, p_dest, p_ctr, p_carriers, p_currency, false);
  if r.id is not null then return public.rate_rule_apply(p_buy, r); end if;
  return null;
end $$;
revoke all on function public.rate_sell_ctx(numeric, text, text, text, text, text, text, text, text[], text, numeric, text, numeric, text, numeric, numeric, boolean) from public, anon, authenticated;

create or replace function public.portal_rate_options(p_account text, p_pol text, p_pod text, p_mode text, p_load text, p_container text, p_ref text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  with q as (
    select upper(trim(coalesce(p_pol, ''))) pol, upper(trim(coalesce(p_pod, ''))) pod,
           lower(coalesce(p_mode, 'sea')) md, upper(coalesce(p_load, '')) lt, upper(trim(coalesce(p_container, ''))) ctr
  ),
  live as (
    select c.*, array[c.shipping_line_code, c.co_loader_code, c.vendor_name] as carriers,
           exists (select 1 from public.rate_card_customers x where x.rate_card_id = c.id and x.account_id = p_account) as is_private
      from public.rate_cards c
     where c.status in ('active', 'validated') and (c.valid_to is null or c.valid_to >= current_date)
       and (not exists (select 1 from public.rate_card_customers x where x.rate_card_id = c.id)
            or exists (select 1 from public.rate_card_customers x where x.rate_card_id = c.id and x.account_id = p_account))
  ),
  fcl as (
    select l.*, c.id as card_id, c.carriers, c.is_private, coalesce(c.vendor_name, c.shipping_line_code) as carrier_name,
           coalesce(l.currency_code, c.currency_code) as cur, least(c.valid_to, l.valid_to) as vto,
           c.default_margin_type, c.default_markup_pct, c.default_margin_fixed
      from public.rate_card_fcl_lines l join live c on c.id = l.rate_card_id, q
     where c.rate_type = 'fcl' and (l.valid_to is null or l.valid_to >= current_date)
       and ((p_ref is null and q.md = 'sea' and q.lt in ('', 'FCL') and l.dest_port_code = q.pod
             and (l.origin_port_code = q.pol or l.origin_group_code in (select group_code from public.port_group_members where port_code = q.pol))
             and (q.ctr = '' or l.container_type = q.ctr))
            or p_ref = 'FCL:' || l.id)
  ),
  lcl as (
    select l.*, c.id as card_id, c.carriers, c.is_private,
           coalesce(l.currency_code, c.currency_code) as cur, least(c.valid_to, l.valid_to) as vto,
           c.default_margin_type, c.default_markup_pct, c.default_margin_fixed
      from public.rate_card_lcl_lines l join live c on c.id = l.rate_card_id, q
     where c.rate_type = 'lcl' and (l.valid_to is null or l.valid_to >= current_date)
       and ((p_ref is null and q.md = 'sea' and q.lt in ('', 'LCL') and l.dest_port_code = q.pod
             and (l.origin_port_code = q.pol or l.origin_group_code in (select group_code from public.port_group_members where port_code = q.pol)))
            or p_ref = 'LCL:' || l.id)
  ),
  air as (
    select l.*, coalesce(l.margin_type, case when l.markup_pct is not null then 'pct' end) as mtype,
           coalesce(l.margin_value, l.markup_pct) as mval, c.id as card_id, c.carriers, c.is_private,
           coalesce(c.vendor_name, c.shipping_line_code) as carrier_name,
           coalesce(l.currency_code, c.currency_code) as cur, c.valid_to as vto,
           c.default_margin_type, c.default_markup_pct, c.default_margin_fixed
      from public.rate_card_air_lines l join live c on c.id = l.rate_card_id, q
     where c.rate_type = 'air'
       and ((p_ref is null and q.md = 'air' and l.dest_port_code = q.pod
             and (l.origin_port_code = q.pol or l.origin_group_code in (select group_code from public.port_group_members where port_code = q.pol)))
            or p_ref = 'AIR:' || l.id)
  ),
  opts as (
    select 'FCL:' || f.id as ref, 'FCL' as product, f.carrier_name as carrier, f.container_type, f.cur as currency, 'per container' as unit,
           public.rate_sell_ctx(f.base_rate, 'rate', 'FCL', p_account, f.origin_port_code, f.origin_group_code, f.dest_port_code, f.container_type, f.carriers, f.cur,
                                f.sell_rate, f.margin_type, f.margin_value, f.default_margin_type, f.default_markup_pct, f.default_margin_fixed, f.is_private) as sell,
           null::numeric as sell_min, null::jsonb as breaks,
           f.is_private or public.rate_is_contract('FCL', p_account, f.origin_port_code, f.origin_group_code, f.dest_port_code, f.container_type, f.carriers, f.cur, f.base_rate) as contract,
           f.transit_days, f.via, null::text as frequency, f.vto as valid_to,
           f.origin_port_code, f.dest_port_code, f.card_id, f.container_type as surcharge_ctr
      from fcl f
    union all
    select 'LCL:' || l.id, 'LCL', 'UB Freight', null, l.cur, 'per W/M (1 m³ or 1,000 kg)',
           public.rate_sell_ctx(l.rate_per_wm, 'rate', 'LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur,
                                l.sell_per_wm, l.margin_type, l.margin_value, l.default_margin_type, l.default_markup_pct, l.default_margin_fixed, l.is_private),
           public.rate_sell_ctx(l.min_charge, 'min', 'LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur,
                                l.sell_min, l.margin_type, l.margin_value, l.default_margin_type, l.default_markup_pct, l.default_margin_fixed, l.is_private),
           null,
           l.is_private or public.rate_is_contract('LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur, l.rate_per_wm),
           l.transit_days, l.via, l.frequency, l.vto,
           l.origin_port_code, l.dest_port_code, l.card_id, null
      from lcl l
    union all
    select 'AIR:' || a.id, 'AIR', a.carrier_name, null, a.cur, 'per kg (chargeable weight)',
           s.n_sell,
           public.rate_sell_ctx(a.min_charge, 'min', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                                null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private),
           jsonb_strip_nulls(jsonb_build_object('n', s.sn, '45', s.s45, '100', s.s100, '250', s.s250, '500', s.s500, '1000', s.s1000)),
           a.is_private or public.rate_is_contract('AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur, coalesce(a.rate_n, a.rate_45)),
           a.transit_days, a.via, a.frequency, a.vto,
           a.origin_port_code, a.dest_port_code, a.card_id, null
      from air a
      cross join lateral (
        select
          public.rate_sell_ctx(coalesce(a.rate_n, a.rate_45), 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private) as n_sell,
          public.rate_sell_ctx(a.rate_n, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private) as sn,
          public.rate_sell_ctx(a.rate_45, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private) as s45,
          public.rate_sell_ctx(a.rate_100, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private) as s100,
          public.rate_sell_ctx(a.rate_250, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private) as s250,
          public.rate_sell_ctx(a.rate_500, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private) as s500,
          public.rate_sell_ctx(a.rate_1000, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed, a.is_private) as s1000
      ) s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'ref', o.ref, 'product', o.product, 'carrier', o.carrier, 'container_type', o.container_type,
      'currency', o.currency, 'unit', o.unit, 'sell', o.sell, 'sell_min', o.sell_min,
      'breaks', case when o.breaks = '{}'::jsonb then null else o.breaks end,
      'contract', coalesce(o.contract, false) and o.sell is not null,
      'transit_days', o.transit_days, 'via', o.via, 'frequency', o.frequency, 'valid_to', o.valid_to,
      'origin', o.origin_port_code, 'destination', o.dest_port_code,
      'extras', (select coalesce(jsonb_agg(jsonb_build_object('label', s.label, 'amount', s.sell_amount,
                   'currency', coalesce(s.currency_code, o.currency), 'basis', s.basis, 'scope', s.scope)), '[]'::jsonb)
                   from public.rate_surcharges s
                  where s.rate_card_id = o.card_id and s.sell_amount is not null
                    and (s.valid_to is null or s.valid_to >= current_date)
                    and (s.container_type is null or s.container_type = o.surcharge_ctr))
    ) order by coalesce(o.contract, false) desc, o.sell is null, o.sell, o.transit_days nulls last), '[]'::jsonb)
  from opts o
$$;
revoke all on function public.portal_rate_options(text, text, text, text, text, text, text) from public, anon, authenticated;

-- Staff preview: customer's options plus what the public would pay for the same line.
create or replace function public.staff_preview_customer_rates(p_account text, p_pol text, p_pod text, p_mode text, p_load text default null, p_container text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  mine jsonb;
  pub jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  mine := public.portal_rate_options(p_account, p_pol, p_pod, p_mode, p_load, p_container, null);
  pub := public.portal_rate_options(null, p_pol, p_pod, p_mode, p_load, p_container, null);
  return coalesce((
    select jsonb_agg(m || jsonb_build_object('public_sell', (select x->'sell' from jsonb_array_elements(pub) x where x->>'ref' = m->>'ref' limit 1)) order by o)
      from jsonb_array_elements(mine) with ordinality t(m, o)), '[]'::jsonb);
end $$;
revoke all on function public.staff_preview_customer_rates(text, text, text, text, text, text) from public, anon;
grant execute on function public.staff_preview_customer_rates(text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

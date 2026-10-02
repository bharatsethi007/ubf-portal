-- lane_rate_summary: rate card snapshot for Freight Intelligence.
-- Live cards (validated/active, in date), cheapest buy/sell per container or break,
-- recently expired cards per carrier, drafts pending, local charge sheets at each end.
-- Staff only. Idempotent. Run once in Supabase SQL editor.

create or replace function public.lane_rate_summary(p_origin text, p_dest text, p_kind text)
returns jsonb
language sql stable security definer set search_path = public
as $fn$
with o_groups as (select group_code from port_group_members where port_code = p_origin),
lines as (
  select r.id card_id, r.title, r.status, r.currency_code card_ccy,
         coalesce(r.co_loader_code, r.shipping_line_code) carrier_code, r.vendor_name,
         coalesce(l.valid_from, r.valid_from) vf, coalesce(l.valid_to, r.valid_to) vt,
         l.container_type as k, l.base_rate buy, l.sell_rate sell, null::numeric min_chg,
         l.currency_code ccy, l.transit_days, l.via
  from rate_card_fcl_lines l join rate_cards r on r.id = l.rate_card_id
  where lower(p_kind) = 'fcl' and l.dest_port_code = p_dest
    and (l.origin_port_code = p_origin or l.origin_group_code in (select group_code from o_groups))
  union all
  select r.id, r.title, r.status, r.currency_code, coalesce(r.co_loader_code, r.shipping_line_code), r.vendor_name,
         coalesce(l.valid_from, r.valid_from), coalesce(l.valid_to, r.valid_to),
         'W/M', l.rate_per_wm, l.sell_per_wm, l.min_charge, l.currency_code, l.transit_days, l.via
  from rate_card_lcl_lines l join rate_cards r on r.id = l.rate_card_id
  where lower(p_kind) = 'lcl' and l.dest_port_code = p_dest
    and (l.origin_port_code = p_origin or l.origin_group_code in (select group_code from o_groups))
  union all
  select r.id, r.title, r.status, r.currency_code, coalesce(r.shipping_line_code, r.vendor_name), r.vendor_name,
         r.valid_from, r.valid_to,
         coalesce(r.air_product, 'GEN') || ' +100kg', l.rate_100, null, l.min_charge, l.currency_code, l.transit_days, l.via
  from rate_card_air_lines l join rate_cards r on r.id = l.rate_card_id
  where lower(p_kind) = 'air' and l.dest_port_code = p_dest
    and (l.origin_port_code = p_origin or l.origin_group_code in (select group_code from o_groups))
),
tagged as (
  select *, (status in ('validated','active')
             and current_date >= coalesce(vf, '-infinity'::date)
             and current_date <= coalesce(vt, 'infinity'::date)) as live
  from lines
),
card_live as (
  select card_id, title, carrier_code, vendor_name, min(vt) vt,
         coalesce(max(ccy), max(card_ccy)) ccy, min(transit_days) transit, max(via) via,
         jsonb_agg(jsonb_build_object('k', k, 'buy', buy, 'sell', sell, 'min', min_chg) order by k) rows
  from (select card_id, title, carrier_code, vendor_name, vt, ccy, card_ccy, transit_days, via, k,
               min(buy) buy, min(sell) sell, min(min_chg) min_chg
        from tagged where live group by 1,2,3,4,5,6,7,8,9,10) x
  group by 1,2,3,4
),
expired as (
  select distinct on (carrier_code) carrier_code, vendor_name, vt,
         coalesce(ccy, card_ccy) ccy, card_id
  from tagged
  where not live and status in ('validated','active','expired') and vt is not null
    and vt < current_date and vt >= current_date - 180
    and carrier_code not in (select carrier_code from tagged where live and carrier_code is not null)
  order by carrier_code, vt desc
)
select jsonb_build_object(
  'kind', lower(p_kind),
  'live', coalesce((select jsonb_agg(jsonb_build_object(
      'card_id', c.card_id, 'title', c.title, 'carrier', c.carrier_code,
      'carrier_name', coalesce(sl.name, co.name, c.vendor_name, c.carrier_code),
      'valid_to', c.vt, 'days_left', case when c.vt is null then null else c.vt - current_date end,
      'currency', c.ccy, 'transit_days', c.transit, 'via', c.via, 'rows', c.rows)
      order by c.vt nulls last)
    from card_live c
    left join shipping_lines sl on sl.code = c.carrier_code
    left join co_loaders co on co.code = c.carrier_code), '[]'::jsonb),
  'expired', coalesce((select jsonb_agg(jsonb_build_object(
      'carrier', e.carrier_code, 'carrier_name', coalesce(sl.name, co.name, e.vendor_name, e.carrier_code),
      'valid_to', e.vt, 'currency', e.ccy,
      'rows', (select jsonb_agg(jsonb_build_object('k', t.k, 'buy', t.buy, 'sell', t.sell) order by t.k)
               from (select k, min(buy) buy, min(sell) sell from tagged where card_id = e.card_id group by k) t))
      order by e.vt desc)
    from expired e
    left join shipping_lines sl on sl.code = e.carrier_code
    left join co_loaders co on co.code = e.carrier_code), '[]'::jsonb),
  'drafts', (select count(distinct card_id) from tagged where status = 'draft'),
  'local_origin', case when lower(p_kind) = 'air' then
      (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'valid_to', valid_to)), '[]'::jsonb) from air_local_charge_sheets
        where status = 'active' and p_origin = any(airport_codes) and direction = 'origin' and (valid_to is null or valid_to >= current_date))
    else
      (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'valid_to', valid_to)), '[]'::jsonb) from local_charge_sheets
        where status = 'active' and mode = lower(p_kind) and p_origin = any(port_codes) and direction = 'origin' and (valid_to is null or valid_to >= current_date))
    end,
  'local_dest', case when lower(p_kind) = 'air' then
      (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'valid_to', valid_to)), '[]'::jsonb) from air_local_charge_sheets
        where status = 'active' and p_dest = any(airport_codes) and direction <> 'origin' and (valid_to is null or valid_to >= current_date))
    else
      (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'valid_to', valid_to)), '[]'::jsonb) from local_charge_sheets
        where status = 'active' and mode = lower(p_kind) and p_dest = any(port_codes) and direction <> 'origin' and (valid_to is null or valid_to >= current_date))
    end
)
where is_staff();
$fn$;

revoke all on function public.lane_rate_summary(text,text,text) from public, anon;
grant execute on function public.lane_rate_summary(text,text,text) to authenticated;

notify pgrst, 'reload schema';

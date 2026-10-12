-- Customer contract rates (lane-level pricing) for portal rate search. Idempotent.
--   * rate_margin_rules gains optional lane scope: origin (port or group), destination, container, carrier,
--     validity dates, currency, and a third method 'fixed' (set sell price per unit).
--   * Most specific active rule wins: origin/dest 8 each, container 4, carrier 2. Newest edit breaks ties.
--   * Order of pricing (rate_sell_ctx):
--       customer rule > line sell > line margin > card margin > default rule > price on request
--   * Fixed rules price the main rate and air breaks only. Minimum charges fall through to the next rule.
--   * Also folds in the 1 Oct card/line fixed margins, which the portal search was ignoring.
--   * portal_rate_options returns 'contract': true when a customer lane rule priced the option.

alter table public.rate_margin_rules
  add column if not exists origin_code text,
  add column if not exists dest_code text,
  add column if not exists container_type text,
  add column if not exists carrier text,
  add column if not exists currency_code text,
  add column if not exists valid_from date,
  add column if not exists valid_to date;

alter table public.rate_margin_rules drop constraint if exists rate_margin_rules_method_check;
alter table public.rate_margin_rules add constraint rate_margin_rules_method_check check (method in ('pct', 'flat', 'fixed'));

alter table public.rate_margin_rules drop constraint if exists rate_margin_rules_fixed_needs_lane;
alter table public.rate_margin_rules add constraint rate_margin_rules_fixed_needs_lane
  check (method <> 'fixed' or (dest_code is not null and account_id is not null));

alter table public.rate_margin_rules drop constraint if exists rate_margin_rules_valid_range;
alter table public.rate_margin_rules add constraint rate_margin_rules_valid_range
  check (valid_from is null or valid_to is null or valid_to >= valid_from);

-- Old key was (account, product). Lane rules need the lane + start date in the key.
alter table public.rate_margin_rules drop constraint if exists rate_margin_rules_account_id_product_key;
drop index if exists public.rate_margin_rules_scope_uq;
create unique index rate_margin_rules_scope_uq on public.rate_margin_rules
  (coalesce(account_id, ''), product, coalesce(origin_code, ''), coalesce(dest_code, ''),
   coalesce(container_type, ''), coalesce(carrier, ''), coalesce(valid_from, '1900-01-01'::date));

create index if not exists rate_margin_rules_lookup on public.rate_margin_rules (product, account_id) where active;

-- Normalise codes on write so matching is a plain equality.
create or replace function public.rate_margin_rules_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.origin_code := nullif(upper(trim(new.origin_code)), '');
  new.dest_code := nullif(upper(trim(new.dest_code)), '');
  new.container_type := nullif(upper(trim(new.container_type)), '');
  new.carrier := nullif(upper(trim(new.carrier)), '');
  new.currency_code := nullif(upper(trim(new.currency_code)), '');
  return new;
end $$;

-- Best matching rule for one rate line. p_scope_account null = default rules only.
create or replace function public.rate_rule_pick(
  p_product text, p_scope_account text, p_origin text, p_origin_group text, p_dest text,
  p_ctr text, p_carriers text[], p_currency text, p_allow_fixed boolean
) returns public.rate_margin_rules
language sql stable security definer set search_path = public as $$
  select r.* from public.rate_margin_rules r
   where r.active and r.product = p_product
     and r.account_id is not distinct from p_scope_account
     and (r.origin_code is null or r.origin_code = upper(p_origin) or r.origin_code = upper(p_origin_group))
     and (r.dest_code is null or r.dest_code = upper(p_dest))
     and (r.container_type is null or r.container_type = upper(p_ctr))
     and (r.carrier is null or r.carrier = any (select upper(x) from unnest(p_carriers) x where x is not null))
     and (r.valid_from is null or r.valid_from <= current_date)
     and (r.valid_to is null or r.valid_to >= current_date)
     and (r.method <> 'fixed' or (p_allow_fixed and (r.currency_code is null or r.currency_code = upper(p_currency))))
   order by (r.origin_code is not null)::int * 8 + (r.dest_code is not null)::int * 8
          + (r.container_type is not null)::int * 4 + (r.carrier is not null)::int * 2 desc,
            r.updated_at desc
   limit 1
$$;
revoke all on function public.rate_rule_pick(text, text, text, text, text, text, text[], text, boolean) from public, anon, authenticated;

create or replace function public.rate_rule_apply(p_buy numeric, r public.rate_margin_rules)
returns numeric language sql immutable as $$
  select case
    when r.id is null then null
    when r.method = 'fixed' then round(r.value, 2)
    when r.method = 'pct' then round(greatest(p_buy * (1 + r.value / 100), p_buy + coalesce(r.min_margin, 0)), 2)
    else round(greatest(p_buy + r.value, p_buy + coalesce(r.min_margin, 0)), 2)
  end
$$;
revoke all on function public.rate_rule_apply(numeric, public.rate_margin_rules) from public, anon, authenticated;

-- Buy -> sell with lane context. p_kind 'rate' (main / breaks) or 'min' (minimum charge).
create or replace function public.rate_sell_ctx(
  p_buy numeric, p_kind text, p_product text, p_account text,
  p_origin text, p_origin_group text, p_dest text, p_ctr text, p_carriers text[], p_currency text,
  p_line_sell numeric, p_line_mtype text, p_line_mval numeric,
  p_card_mtype text, p_card_pct numeric, p_card_fixed numeric
) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  r public.rate_margin_rules;
begin
  if p_buy is null then return null; end if;
  if p_account is not null then
    r := public.rate_rule_pick(p_product, p_account, p_origin, p_origin_group, p_dest, p_ctr, p_carriers, p_currency, p_kind = 'rate');
    if r.id is not null then return public.rate_rule_apply(p_buy, r); end if;
  end if;
  if p_line_sell is not null then return round(p_line_sell, 2); end if;
  if p_line_mval is not null then
    return round(case when p_line_mtype = 'fixed' then p_buy + p_line_mval else p_buy * (1 + p_line_mval / 100) end, 2);
  end if;
  if p_card_mtype = 'fixed' and p_card_fixed is not null then return round(p_buy + p_card_fixed, 2); end if;
  if p_card_pct is not null then return round(p_buy * (1 + p_card_pct / 100), 2); end if;
  r := public.rate_rule_pick(p_product, null, p_origin, p_origin_group, p_dest, p_ctr, p_carriers, p_currency, false);
  if r.id is not null then return public.rate_rule_apply(p_buy, r); end if;
  return null;
end $$;
revoke all on function public.rate_sell_ctx(numeric, text, text, text, text, text, text, text, text[], text, numeric, text, numeric, text, numeric, numeric) from public, anon, authenticated;

-- True when a customer lane rule (not a product-wide margin) prices this line.
create or replace function public.rate_is_contract(
  p_product text, p_account text, p_origin text, p_origin_group text, p_dest text, p_ctr text, p_carriers text[], p_currency text
) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select r.origin_code is not null or r.dest_code is not null or r.container_type is not null or r.carrier is not null
     from public.rate_rule_pick(p_product, p_account, p_origin, p_origin_group, p_dest, p_ctr, p_carriers, p_currency, true) r
    where r.id is not null), false)
$$;
revoke all on function public.rate_is_contract(text, text, text, text, text, text, text[], text) from public, anon, authenticated;

create or replace function public.portal_rate_options(p_account text, p_pol text, p_pod text, p_mode text, p_load text, p_container text, p_ref text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  with q as (
    select upper(trim(coalesce(p_pol, ''))) pol, upper(trim(coalesce(p_pod, ''))) pod,
           lower(coalesce(p_mode, 'sea')) md, upper(coalesce(p_load, '')) lt, upper(trim(coalesce(p_container, ''))) ctr
  ),
  live as (
    select c.*, array[c.shipping_line_code, c.co_loader_code, c.vendor_name] as carriers
      from public.rate_cards c
     where c.status in ('active', 'validated') and (c.valid_to is null or c.valid_to >= current_date)
  ),
  fcl as (
    select l.*, c.id as card_id, c.carriers, coalesce(c.vendor_name, c.shipping_line_code) as carrier_name,
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
    select l.*, c.id as card_id, c.carriers, coalesce(c.vendor_name, c.shipping_line_code) as carrier_name,
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
           coalesce(l.margin_value, l.markup_pct) as mval, c.id as card_id, c.carriers, coalesce(c.vendor_name, c.shipping_line_code) as carrier_name,
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
                                f.sell_rate, f.margin_type, f.margin_value, f.default_margin_type, f.default_markup_pct, f.default_margin_fixed) as sell,
           null::numeric as sell_min, null::jsonb as breaks,
           public.rate_is_contract('FCL', p_account, f.origin_port_code, f.origin_group_code, f.dest_port_code, f.container_type, f.carriers, f.cur) as contract,
           f.transit_days, f.via, null::text as frequency, f.vto as valid_to,
           f.origin_port_code, f.dest_port_code, f.card_id, f.container_type as surcharge_ctr
      from fcl f
    union all
    select 'LCL:' || l.id, 'LCL', l.carrier_name, null, l.cur, 'per W/M (1 m³ or 1,000 kg)',
           public.rate_sell_ctx(l.rate_per_wm, 'rate', 'LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur,
                                l.sell_per_wm, l.margin_type, l.margin_value, l.default_margin_type, l.default_markup_pct, l.default_margin_fixed),
           public.rate_sell_ctx(l.min_charge, 'min', 'LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur,
                                l.sell_min, l.margin_type, l.margin_value, l.default_margin_type, l.default_markup_pct, l.default_margin_fixed),
           null,
           public.rate_is_contract('LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur),
           l.transit_days, l.via, l.frequency, l.vto,
           l.origin_port_code, l.dest_port_code, l.card_id, null
      from lcl l
    union all
    select 'AIR:' || a.id, 'AIR', a.carrier_name, null, a.cur, 'per kg (chargeable weight)',
           s.n_sell,
           public.rate_sell_ctx(a.min_charge, 'min', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                                null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed),
           jsonb_strip_nulls(jsonb_build_object('n', s.sn, '45', s.s45, '100', s.s100, '250', s.s250, '500', s.s500, '1000', s.s1000)),
           public.rate_is_contract('AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur),
           a.transit_days, a.via, a.frequency, a.vto,
           a.origin_port_code, a.dest_port_code, a.card_id, null
      from air a
      cross join lateral (
        select
          public.rate_sell_ctx(coalesce(a.rate_n, a.rate_45), 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed) as n_sell,
          public.rate_sell_ctx(a.rate_n, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed) as sn,
          public.rate_sell_ctx(a.rate_45, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed) as s45,
          public.rate_sell_ctx(a.rate_100, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed) as s100,
          public.rate_sell_ctx(a.rate_250, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed) as s250,
          public.rate_sell_ctx(a.rate_500, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed) as s500,
          public.rate_sell_ctx(a.rate_1000, 'rate', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                               null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed) as s1000
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

-- Staff preview: exactly what a customer would see. Used by the Customer Rates tab.
create or replace function public.staff_preview_customer_rates(p_account text, p_pol text, p_pod text, p_mode text, p_load text default null, p_container text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  return public.portal_rate_options(p_account, p_pol, p_pod, p_mode, p_load, p_container, null);
end $$;
revoke all on function public.staff_preview_customer_rates(text, text, text, text, text, text) from public, anon;
grant execute on function public.staff_preview_customer_rates(text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

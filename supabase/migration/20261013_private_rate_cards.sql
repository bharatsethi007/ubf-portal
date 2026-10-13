-- Private rate cards (one or more customers) + LCL co-loader name fix. Idempotent.
--   * rate_card_customers: no rows = every customer sees the card. Rows = only those customers.
--   * Portal search only returns public cards plus cards shared with the searching customer.
--   * Lines from a card shared with the customer are tagged as contract rates.
--   * LCL options show "UB Freight" as carrier. Co-loaders are never shown to customers.

create table if not exists public.rate_card_customers (
  rate_card_id uuid not null references public.rate_cards(id) on delete cascade,
  account_id text not null references public.customers(account_id) on delete cascade,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (rate_card_id, account_id)
);
create index if not exists rate_card_customers_account_idx on public.rate_card_customers (account_id);
alter table public.rate_card_customers enable row level security;
drop policy if exists rcc_staff_all on public.rate_card_customers;
create policy rcc_staff_all on public.rate_card_customers for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

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
                                f.sell_rate, f.margin_type, f.margin_value, f.default_margin_type, f.default_markup_pct, f.default_margin_fixed) as sell,
           null::numeric as sell_min, null::jsonb as breaks,
           f.is_private or public.rate_is_contract('FCL', p_account, f.origin_port_code, f.origin_group_code, f.dest_port_code, f.container_type, f.carriers, f.cur) as contract,
           f.transit_days, f.via, null::text as frequency, f.vto as valid_to,
           f.origin_port_code, f.dest_port_code, f.card_id, f.container_type as surcharge_ctr
      from fcl f
    union all
    select 'LCL:' || l.id, 'LCL', 'UB Freight', null, l.cur, 'per W/M (1 m³ or 1,000 kg)',
           public.rate_sell_ctx(l.rate_per_wm, 'rate', 'LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur,
                                l.sell_per_wm, l.margin_type, l.margin_value, l.default_margin_type, l.default_markup_pct, l.default_margin_fixed),
           public.rate_sell_ctx(l.min_charge, 'min', 'LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur,
                                l.sell_min, l.margin_type, l.margin_value, l.default_margin_type, l.default_markup_pct, l.default_margin_fixed),
           null,
           l.is_private or public.rate_is_contract('LCL', p_account, l.origin_port_code, l.origin_group_code, l.dest_port_code, null, l.carriers, l.cur),
           l.transit_days, l.via, l.frequency, l.vto,
           l.origin_port_code, l.dest_port_code, l.card_id, null
      from lcl l
    union all
    select 'AIR:' || a.id, 'AIR', a.carrier_name, null, a.cur, 'per kg (chargeable weight)',
           s.n_sell,
           public.rate_sell_ctx(a.min_charge, 'min', 'AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur,
                                null, a.mtype, a.mval, a.default_margin_type, a.default_markup_pct, a.default_margin_fixed),
           jsonb_strip_nulls(jsonb_build_object('n', s.sn, '45', s.s45, '100', s.s100, '250', s.s250, '500', s.s500, '1000', s.s1000)),
           a.is_private or public.rate_is_contract('AIR', p_account, a.origin_port_code, a.origin_group_code, a.dest_port_code, null, a.carriers, a.cur),
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

notify pgrst, 'reload schema';

-- Cleanup: temp price baseline from 13 Oct contract-rates check.
drop table if exists public._tmp_rate_baseline;

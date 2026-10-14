-- Brainbox pricing evidence: what UBF actually billed (TradeWindow job_charges) per lane,
-- compared with the local charge sheets. Suggests card lines and customer exceptions.
-- Needs 20261015c_brainbox_insights.sql. Air export first (AKL > NAN).

begin;

create index if not exists idx_job_charges_date on public.job_charges (charge_date);

-- ── 1. ERP charge code -> portal charge code ──────────────────────────────────
create table if not exists public.erp_charge_map (
  erp_code    text primary key,
  charge_code text references public.charge_codes(code) on update cascade,
  treat_as    text not null default 'standard'
              check (treat_as in ('standard', 'contingent', 'freight', 'passthrough', 'ignore')),
  confirmed   boolean not null default false,
  sample_desc text,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);
alter table public.erp_charge_map enable row level security;
drop policy if exists staff_read_erp_charge_map on public.erp_charge_map;
create policy staff_read_erp_charge_map on public.erp_charge_map for select using (public.is_staff());

-- Seed every ERP code billed in the last 12 months with a best-guess portal code (unconfirmed).
insert into public.erp_charge_map (erp_code, charge_code, treat_as, sample_desc)
select d.erp_code,
       (select c.code from public.charge_codes c
         where c.active and similarity(lower(c.description), lower(d.sample_desc)) > 0.35
         order by similarity(lower(c.description), lower(d.sample_desc)) desc limit 1),
       case when d.erp_code in ('FEA', 'FES', 'FIA', 'FIS', 'FEA1', 'FES1', 'FIA1', 'FIS1') then 'freight'
            when d.erp_code in (select charge_code from public.charge_passthrough) then 'passthrough'
            else 'standard' end,
       d.sample_desc
from (
  select jc.charge_code as erp_code,
         mode() within group (order by regexp_replace(jc.description, '\s*\(.*$', '')) as sample_desc
  from public.job_charges jc
  where jc.charge_date >= now() - interval '12 months' and jc.sell <> 0 and jc.charge_code is not null
  group by 1
) d
on conflict (erp_code) do nothing;

create or replace function public.brainbox_map_erp_code(p_erp_code text, p_charge_code text, p_treat_as text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('brainbox', 'edit') then raise exception 'Only Bharat or a Pricing Lead can map codes'; end if;
  update erp_charge_map
     set charge_code = nullif(p_charge_code, ''), treat_as = p_treat_as, confirmed = true,
         updated_by = auth.uid(), updated_at = now()
   where erp_code = p_erp_code;
end $$;

-- ── 2. Audit of card changes made from evidence ───────────────────────────────
create table if not exists public.brainbox_card_changes (
  id         uuid primary key default gen_random_uuid(),
  sheet_id   uuid not null,
  line_id    uuid,
  before     jsonb,
  after      jsonb not null,
  evidence   jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
alter table public.brainbox_card_changes enable row level security;
drop policy if exists staff_read_brainbox_card_changes on public.brainbox_card_changes;
create policy staff_read_brainbox_card_changes on public.brainbox_card_changes for select using (public.is_staff());

-- ── 3. Lane evidence ──────────────────────────────────────────────────────────
-- One row per ERP charge code billed on the lane. Prices are per job (lines summed),
-- NZD only, sell > 0. Model: 'flat' (one price on 75%+ of jobs), 'min_kg'
-- (max(minimum, rate x chargeable kg) fits 80%+ of jobs) or 'varies'.
create or replace function public.brainbox_lane_evidence(
  p_module text, p_origin text, p_dest text, p_months int default 3, p_product text default 'consol')
returns table (
  erp_code text, charge_code text, label text, treat_as text, confirmed boolean, descs text[],
  jobs int, payers int, model text, price numeric, min_sell numeric, fit numeric, billed numeric, last_seen date,
  sheet_id uuid, sheet_title text, line_id uuid, card_label text, card_basis text, card_sell numeric, card_min numeric,
  verdict text, exceptions jsonb
)
language sql stable set search_path = public as $$
  with jc0 as (
    select jc.charge_code, jc.job_unique, jc.bill_to, jc.sell, jc.charge_date, jc.description
    from job_charges jc
    where jc.charge_date >= now() - make_interval(months => p_months)
      and jc.sell > 0 and coalesce(jc.currency, 'NZD') = 'NZD' and jc.charge_code is not null
  ), sh as (
    select s.job_unique, s.consol_key, s.weight_kg, s.volume_m3
    from shipments s
    where s.job_unique in (select job_unique from jc0)
      and s.module = p_module and s.origin = p_origin and s.destination = p_dest
  ), houses as (
    select consol_key, count(*) n from shipments
    where module = p_module and consol_key in (select consol_key from sh where consol_key is not null)
    group by 1
  ), jobs as (
    select sh.job_unique,
           case when coalesce(h.n, 1) > 1 then 'consol' else 'direct' end as product,
           case when p_module in ('FEA', 'FIA')
                then greatest(coalesce(sh.weight_kg, 0), coalesce(sh.volume_m3, 0) * 167)
                else greatest(coalesce(sh.volume_m3, 0), coalesce(sh.weight_kg, 0) / 1000) end as cw
    from sh left join houses h on h.consol_key = sh.consol_key
  ), lines as (
    select jc.charge_code as erp_code, jc.job_unique, jc.bill_to, j.cw,
           sum(jc.sell) as sell, max(jc.charge_date) as dt,
           max(regexp_replace(jc.description, '\s*\(.*$', '')) as descr
    from jc0 jc
    join jobs j on j.job_unique = jc.job_unique
    where (p_product is null or j.product = p_product)
    group by 1, 2, 3, 4
  ), base as (
    select l.erp_code, count(*)::int jobs, count(distinct l.bill_to)::int payers,
           mode() within group (order by l.sell) mode_v,
           sum(l.sell) billed, max(l.dt)::date last_seen,
           (array_agg(distinct l.descr))[1:4] descs
    from lines l group by 1
  ), fit as (
    select b.*,
           round((select count(*) from lines l where l.erp_code = b.erp_code and l.sell = b.mode_v)::numeric / b.jobs, 3) mode_share,
           (select percentile_cont(0.5) within group (order by l.sell / l.cw)
              from lines l where l.erp_code = b.erp_code and l.cw > 0 and l.sell > b.mode_v * 1.01) rate,
           (select count(*) from lines l where l.erp_code = b.erp_code and l.sell > b.mode_v * 1.01) n_above
    from base b
  ), fit2 as (
    select f.*,
           round((select count(*) from lines l where l.erp_code = f.erp_code and l.cw > 0
                   and abs(l.sell - greatest(f.mode_v, f.rate * l.cw)) <= greatest(0.5, 0.03 * l.sell))::numeric / f.jobs, 3) kg_fit
    from fit f
  ), modeled as (
    select f.*,
           case when f.mode_share >= 0.75 then 'flat'
                when f.rate is not null and f.n_above >= 5 and f.kg_fit >= 0.8 then 'min_kg'
                else 'varies' end as model
    from fit2 f
  ), sheet as (
    select s.id, s.title from air_local_charge_sheets s
    where s.status = 'validated' and p_origin = any(s.airport_codes)
      and (coalesce(cardinality(s.dest_airport_codes), 0) = 0 or p_dest = any(s.dest_airport_codes))
      and coalesce(s.cargo_class, 'general') = 'general'
      and s.air_product = coalesce(p_product, 'consol')
    order by (p_dest = any(s.dest_airport_codes)) desc, s.updated_at desc limit 1
  )
  select m.erp_code, em.charge_code, coalesce(cc.description, em.sample_desc, m.descs[1]), coalesce(em.treat_as, 'standard'),
         coalesce(em.confirmed, false), m.descs, m.jobs, m.payers, m.model,
         case m.model when 'flat' then m.mode_v when 'min_kg' then round(m.rate::numeric, 3) else null end,
         case when m.model = 'min_kg' then m.mode_v end,
         case m.model when 'flat' then m.mode_share when 'min_kg' then m.kg_fit else greatest(m.mode_share, coalesce(m.kg_fit, 0)) end,
         round(m.billed, 2), m.last_seen,
         sh.id, sh.title, cl.id, cl.label, cl.basis, cl.sell_amount, cl.min_sell,
         case
           when coalesce(em.treat_as, 'standard') in ('freight', 'passthrough', 'ignore') then 'skip'
           when em.treat_as = 'contingent' then 'extra'
           when em.charge_code is null or not coalesce(em.confirmed, false) then 'unmapped'
           when m.model = 'varies' or m.jobs < 30 or m.payers < 3 then 'weak'
           when cl.id is null then 'add'
           when m.model = 'flat' and cl.basis <> 'per_kg' and abs(cl.sell_amount - m.mode_v) <= 0.05 * m.mode_v then 'agrees'
           when m.model = 'min_kg' and cl.basis = 'per_kg' and abs(cl.sell_amount - m.rate) <= 0.05 * m.rate
                and abs(coalesce(cl.min_sell, 0) - m.mode_v) <= 0.05 * m.mode_v then 'agrees'
           else 'update' end,
         coalesce((
           select jsonb_agg(x order by x->>'jobs' desc) from (
             select jsonb_build_object('account_id', p.bill_to, 'name', coalesce(c.name, p.bill_to),
                                       'jobs', p.n, 'price', p.mv, 'share', p.share) x
             from (
               select l.bill_to, count(*) n, mode() within group (order by l.sell) mv,
                      round(count(*) filter (where l.sell = (select mode() within group (order by l2.sell)
                                                            from lines l2 where l2.erp_code = l.erp_code and l2.bill_to = l.bill_to))::numeric
                            / count(*), 2) share
               from lines l where l.erp_code = m.erp_code group by l.erp_code, l.bill_to having count(*) >= 5
             ) p
             left join customers c on c.account_id = p.bill_to
             where m.model = 'flat' and p.share >= 0.8 and abs(p.mv - m.mode_v) > 0.1 * m.mode_v
             order by p.n desc limit 5
           ) z), '[]'::jsonb)
  from modeled m
  left join erp_charge_map em on em.erp_code = m.erp_code
  left join charge_codes cc on cc.code = em.charge_code
  left join sheet sh on true
  left join lateral (
    select l.id, l.label, l.basis, l.sell_amount, l.min_sell from air_local_charge_lines l
    where l.sheet_id = sh.id and em.charge_code is not null
      and coalesce(l.charge_code, brainbox_resolve_charge_code(l.label)) = em.charge_code
    order by l.ord limit 1
  ) cl on true
  order by m.billed desc
$$;

-- ── 4. Apply evidence to a charge sheet line (approvers only, audited) ────────
create or replace function public.brainbox_apply_card_line(
  p_sheet uuid, p_line uuid, p_label text, p_charge_code text, p_basis text,
  p_sell numeric, p_min numeric, p_evidence jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_before jsonb; v_id uuid; v_group text;
begin
  if not has_perm('brainbox', 'edit') then raise exception 'Only Bharat or a Pricing Lead can change cards'; end if;
  if p_line is not null then
    select to_jsonb(l) into v_before from air_local_charge_lines l where l.id = p_line and l.sheet_id = p_sheet;
    if v_before is null then raise exception 'Card line not found'; end if;
    update air_local_charge_lines
       set sell_amount = p_sell, min_sell = p_min, basis = p_basis,
           charge_code = coalesce(charge_code, p_charge_code)
     where id = p_line
     returning id into v_id;
  else
    select charge_group into v_group from charge_codes where code = p_charge_code;
    insert into air_local_charge_lines (sheet_id, ord, charge_code, label, charge_group, basis,
                                        sell_amount, sell_currency, min_sell, buy_amount, buy_currency, contingent)
    values (p_sheet, coalesce((select max(ord) + 1 from air_local_charge_lines where sheet_id = p_sheet), 0),
            p_charge_code, p_label, coalesce(v_group, 'origin'), p_basis,
            p_sell, 'NZD', p_min, 0, 'NZD', false)
    returning id into v_id;
  end if;
  insert into brainbox_card_changes (sheet_id, line_id, before, after, evidence)
  values (p_sheet, v_id, v_before,
          jsonb_build_object('label', p_label, 'charge_code', p_charge_code, 'basis', p_basis, 'sell', p_sell, 'min', p_min),
          p_evidence);
  return v_id;
end $$;

-- ── 5. Customer exception -> suggested customer rule ──────────────────────────
create or replace function public.brainbox_suggest_payer_rule(
  p_account text, p_charge_code text, p_amount numeric, p_lane jsonb, p_evidence jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_label text;
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  select id into v_id from brainbox_rules
   where status in ('suggested', 'active') and scope->>'account_id' = p_account
     and action->>'charge_code' = p_charge_code and scope->'lane' = p_lane limit 1;
  if v_id is not null then return v_id; end if;
  select name into v_name from customers where account_id = p_account;
  select description into v_label from charge_codes where code = p_charge_code;
  insert into brainbox_rules (kind, scope, action, prose, priority, status, origin, evidence)
  values ('set_rate', jsonb_build_object('account_id', p_account, 'lane', p_lane),
          jsonb_build_object('charge_code', p_charge_code, 'label', v_label, 'currency', 'NZD',
                             'unit_class', 'flat', 'amount', p_amount),
          format('%s pays %s NZD %s on %s %s to %s.', coalesce(v_name, p_account), coalesce(v_label, p_charge_code),
                 trim(to_char(p_amount, 'FM999G990D00')), p_lane->>'module', p_lane->>'origin', p_lane->>'dest'),
          10, 'suggested', 'learned', p_evidence)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.brainbox_map_erp_code(text, text, text) from public, anon;
revoke execute on function public.brainbox_apply_card_line(uuid, uuid, text, text, text, numeric, numeric, jsonb) from public, anon;
revoke execute on function public.brainbox_suggest_payer_rule(text, text, numeric, jsonb, jsonb) from public, anon;
grant execute on function public.brainbox_map_erp_code(text, text, text) to authenticated;
grant execute on function public.brainbox_apply_card_line(uuid, uuid, text, text, text, numeric, numeric, jsonb) to authenticated;
grant execute on function public.brainbox_suggest_payer_rule(text, text, numeric, jsonb, jsonb) to authenticated;
grant execute on function public.brainbox_lane_evidence(text, text, text, int, text) to authenticated;

commit;

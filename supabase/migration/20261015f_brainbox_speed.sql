-- Brainbox speed fix: billing tables have row security that checks staff on every row
-- (1.5M rows), which timed out. These read-only functions now check staff once, up front.

begin;

create or replace function public.brainbox_neural_graph(p_months int default 6)
returns jsonb language plpgsql stable security definer set search_path = public as $fn$
declare v jsonb;
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  execute $q$
with j as (
    select jc.charge_code as c, jc.job_unique, jc.bill_to,
           s.module || ' ' || s.origin || '>' || s.destination as lane,
           s.module, s.origin, s.destination
    from job_charges jc
    join shipments s on s.job_unique = jc.job_unique
    left join erp_charge_map m on m.erp_code = jc.charge_code
    where jc.charge_date >= now() - make_interval(months => $1)
      and jc.sell > 0 and jc.charge_code is not null
      and coalesce(m.treat_as, 'standard') not in ('freight', 'passthrough', 'ignore')
      and jc.charge_code not in ('FEA', 'FES', 'FIA', 'FIS')
  ), tl as (
    select lane, max(module) module, max(origin) origin, max(destination) dest, count(distinct job_unique) n
    from j group by lane order by n desc limit 7
  ), jl as (select * from j where lane in (select lane from tl)
  ), tc as (
    select c, count(distinct job_unique) n from jl group by c order by n desc limit 12
  ), tp as (
    select bill_to, count(distinct job_unique) n from jl where bill_to is not null group by bill_to order by n desc limit 7
  )
  select jsonb_build_object(
    'months', $1,
    'lanes', (select jsonb_agg(jsonb_build_object(
        'id', lane, 'n', n,
        'label', case module when 'FEA' then 'Air ' when 'FIA' then 'Air ' else 'Sea ' end
                 || right(origin, 3) || ' to ' || right(dest, 3)) order by n desc) from tl),
    'charges', (select jsonb_agg(jsonb_build_object(
        'id', tc.c, 'n', tc.n,
        'label', tc.c || ' ' || lower(coalesce(cc.description, regexp_replace(m.sample_desc, '\s*\(.*$', ''), ''))) order by tc.n desc)
      from tc left join erp_charge_map m on m.erp_code = tc.c left join charge_codes cc on cc.code = m.charge_code),
    'payers', (select jsonb_agg(jsonb_build_object(
        'id', tp.bill_to, 'n', tp.n,
        'label', case when tp.bill_to = 'UBNAN' then 'UBF Fiji office' else coalesce(initcap(cu.name), tp.bill_to) end) order by tp.n desc)
      from tp left join customers cu on cu.account_id = tp.bill_to),
    'e1', (select coalesce(jsonb_agg(jsonb_build_object('a', lane, 'b', c, 'n', n)), '[]') from
            (select lane, c, count(distinct job_unique) n from jl where c in (select c from tc) group by 1, 2) x),
    'e2', (select coalesce(jsonb_agg(jsonb_build_object('a', c, 'b', bill_to, 'n', n)), '[]') from
            (select c, bill_to, count(distinct job_unique) n from jl
              where c in (select c from tc) and bill_to in (select bill_to from tp) group by 1, 2) x)
  )
  $q$ into v using p_months;
  return v;
end $fn$;

create or replace function public.brainbox_lane_evidence(
  p_module text, p_origin text, p_dest text, p_months int default 3, p_product text default 'consol')
returns table (
  erp_code text, charge_code text, label text, treat_as text, confirmed boolean, descs text[],
  jobs int, payers int, model text, price numeric, min_sell numeric, fit numeric, billed numeric, last_seen date,
  sheet_id uuid, sheet_title text, line_id uuid, card_label text, card_basis text, card_sell numeric, card_min numeric,
  verdict text, exceptions jsonb
)
language sql stable security definer set search_path = public as $$
  with jc0 as (
    select jc.charge_code, jc.job_unique, jc.bill_to, jc.sell, jc.charge_date, jc.description
    from job_charges jc
    where (select is_staff())
      and jc.charge_date >= now() - make_interval(months => p_months)
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

grant execute on function public.brainbox_neural_graph(int) to authenticated;
grant execute on function public.brainbox_lane_evidence(text, text, text, int, text) to authenticated;
revoke execute on function public.brainbox_neural_graph(int) from anon;
revoke execute on function public.brainbox_lane_evidence(text, text, text, int, text) from anon;

commit;

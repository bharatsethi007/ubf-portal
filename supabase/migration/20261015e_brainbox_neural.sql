-- Brainbox neural view: busiest lanes -> most billed charges -> biggest payers,
-- weighted by jobs billed in TradeWindow. Needs 20261015d_pricing_evidence.sql.

begin;

create or replace function public.brainbox_neural_graph(p_months int default 6)
returns jsonb language sql stable set search_path = public as $$
  with j as (
    select jc.charge_code as c, jc.job_unique, jc.bill_to,
           s.module || ' ' || s.origin || '>' || s.destination as lane,
           s.module, s.origin, s.destination
    from job_charges jc
    join shipments s on s.job_unique = jc.job_unique
    left join erp_charge_map m on m.erp_code = jc.charge_code
    where jc.charge_date >= now() - make_interval(months => p_months)
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
    'months', p_months,
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
$$;

grant execute on function public.brainbox_neural_graph(int) to authenticated;

commit;

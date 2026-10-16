-- Agents > Performance: network groups, reciprocal business, aging agents. Period 1, 3, 6 or 12 months.
-- Free hand and nomination come from billing (v_agent_jobs, see 20261016_agent_job_class.sql).

create or replace function agents_performance(p_months int)
returns jsonb language sql stable security definer set search_path = public, reporting as $$
  with p as (select greatest(1, least(coalesce(p_months, 12), 24)) as m),
  since as (select (current_date - make_interval(months => (select m from p)))::date as d,
                   (current_date - make_interval(months => (select m from p) * 2))::date as d_prior),
  lastj as (
    select a.id as agent_id,
      max(coalesce(l.etd, l.doc_date)) as last_job
    from agents a join shipment_legs l on l.os_agent_code = a.erp_account_code
    group by a.id
  ),
  jf as (   -- one row per agent and job, classed from billing (v_agent_jobs) with staff overrides
    select j.agent_id, j.job_unique, j.dt, agent_job_final(j.auto_class, j.override_class) as cls, f.gross_profit as gp
    from v_agent_jobs j left join reporting.mv_job_financials f on f.job_unique = j.job_unique
  ),
  per as (
    select a.id as agent_id,
      count(*) filter (where jf.cls = 'freehand' and jf.dt >= since.d) as fh,
      count(*) filter (where jf.cls = 'nomination' and jf.dt >= since.d) as nom,
      coalesce(sum(jf.gp) filter (where jf.cls = 'freehand' and jf.dt >= since.d), 0) as fh_gp,
      coalesce(sum(jf.gp) filter (where jf.cls = 'nomination' and jf.dt >= since.d), 0) as nom_gp,
      count(*) filter (where jf.cls = 'freehand' and jf.dt >= since.d_prior and jf.dt < since.d) as fh_prior,
      count(*) filter (where jf.cls = 'nomination' and jf.dt >= since.d_prior and jf.dt < since.d) as nom_prior,
      count(*) filter (where jf.cls = 'exception' and jf.dt >= since.d) as exc,
      count(*) filter (where jf.cls = 'unbilled' and jf.dt >= since.d) as unbilled,
      max(jf.dt) filter (where jf.cls = 'freehand') as last_fh,
      max(jf.dt) filter (where jf.cls = 'nomination') as last_nom,
      count(*) filter (where jf.cls <> 'excluded' and jf.dt >= current_date - 365) as jobs_12m,
      count(*) filter (where jf.cls <> 'excluded' and jf.dt < current_date - 365 and jf.dt >= current_date - 730) as jobs_prev_12m
    from agents a cross join since left join jf on jf.agent_id = a.id
    group by a.id
  ),
  q as (
    select for_agent_id as agent_id,
      count(*) filter (where created_at >= since.d) as quotes,
      count(*) filter (where created_at >= since.d and status in ('won', 'crosswin')) as won,
      count(*) filter (where created_at >= since.d and status = 'lost') as lost,
      count(*) filter (where created_at >= since.d_prior and created_at < since.d) as quotes_prior,
      max(created_at)::date as last_quote
    from v_agent_quotes cross join since
    where for_agent_id is not null
    group by for_agent_id
  ),
  net as (select an.agent_id, fn.code from agent_networks an join freight_networks fn on fn.id = an.network_id),
  ar as (
    select a.id, a.name, a.country, a.status,
      coalesce((select array_agg(code order by code) from net where net.agent_id = a.id), '{}') as networks,
      coalesce(per.fh, 0) fh, coalesce(per.nom, 0) nom, round(coalesce(per.fh_gp, 0)) fh_gp, round(coalesce(per.nom_gp, 0)) nom_gp,
      coalesce(per.fh_prior, 0) fh_prior, coalesce(per.nom_prior, 0) nom_prior,
      per.last_fh, per.last_nom, coalesce(per.exc, 0) exc, coalesce(per.unbilled, 0) unbilled, coalesce(per.jobs_12m, 0) jobs_12m, coalesce(per.jobs_prev_12m, 0) jobs_prev_12m,
      coalesce(q.quotes, 0) quotes, coalesce(q.won, 0) won, coalesce(q.lost, 0) lost, coalesce(q.quotes_prior, 0) quotes_prior, q.last_quote,
      greatest(lj.last_job::date, q.last_quote) as last_any
    from agents a left join per on per.agent_id = a.id left join q on q.agent_id = a.id left join lastj lj on lj.agent_id = a.id
    where coalesce(a.status, 'active') <> 'archived'
  )
  select jsonb_build_object(
    'months', (select m from p),
    'since', (select d from since),
    'kpis', (select jsonb_build_object(
        'quotes', sum(quotes), 'won', sum(won), 'lost', sum(lost), 'quotes_prior', sum(quotes_prior),
        'freehand', sum(fh), 'freehand_prior', sum(fh_prior), 'freehand_gp', sum(fh_gp),
        'nominations', sum(nom), 'nominations_prior', sum(nom_prior), 'nominations_gp', sum(nom_gp),
        'freehand_agents', count(*) filter (where fh > 0), 'nomination_agents', count(*) filter (where nom > 0),
        'reciprocal_agents', count(*) filter (where fh > 0 and nom > 0),
        'quoting_agents', count(*) filter (where quotes > 0),
        'exceptions', sum(exc), 'unbilled', sum(unbilled)) from ar),
    'networks', coalesce((select jsonb_agg(x order by x.fh + x.nom desc, x.quotes desc) from (
        select coalesce(n.code, 'No network') as network, count(distinct r.id) agents,
          count(distinct r.id) filter (where r.fh > 0 or r.nom > 0 or r.quotes > 0) active_agents,
          sum(r.quotes) quotes, sum(r.won) won, sum(r.lost) lost,
          sum(r.fh) fh, sum(r.fh_gp) fh_gp, sum(r.nom) nom, sum(r.nom_gp) nom_gp,
          count(distinct r.id) filter (where r.fh > 0 and r.nom > 0) reciprocal,
          sum(r.fh_prior) fh_prior, sum(r.nom_prior) nom_prior, sum(r.exc) exc, sum(r.unbilled) unbilled
        from ar r left join net n on n.agent_id = r.id
        group by coalesce(n.code, 'No network')) x), '[]'::jsonb),
    'reciprocal', coalesce((select jsonb_agg(x order by x.fh + x.nom desc) from (
        select id, name, country, networks, fh, fh_gp, nom, nom_gp, quotes, won, last_any
        from ar where fh > 0 and nom > 0 order by fh + nom desc limit 60) x), '[]'::jsonb),
    'one_way', (select jsonb_build_object(
        'freehand_only', count(*) filter (where fh > 0 and nom = 0),
        'nomination_only', count(*) filter (where nom > 0 and fh = 0)) from ar),
    'aging', coalesce((select jsonb_agg(x order by x.prior_jobs desc, x.days_idle desc) from (
        select id, name, country, networks, last_fh, last_nom, last_quote, last_any,
          (current_date - last_any) as days_idle, jobs_12m, jobs_prev_12m as prior_jobs,
          case when last_any is null then 'never'
               when current_date - last_any > 365 then 'inactive'
               when current_date - last_any > 180 then 'dormant'
               when current_date - last_any > 90 then 'cooling' else 'slipping' end as bucket
        from ar
        where (last_any is not null and current_date - last_any > 90)
           or (jobs_prev_12m > 0 and jobs_12m * 2 < jobs_prev_12m)
        order by jobs_prev_12m desc limit 80) x), '[]'::jsonb),
    'buckets', (select jsonb_build_object(
        'active', count(*) filter (where last_any >= current_date - 90),
        'cooling', count(*) filter (where last_any < current_date - 90 and last_any >= current_date - 180),
        'dormant', count(*) filter (where last_any < current_date - 180 and last_any >= current_date - 365),
        'inactive', count(*) filter (where last_any < current_date - 365),
        'never', count(*) filter (where last_any is null),
        'slipping', count(*) filter (where jobs_prev_12m >= 4 and jobs_12m * 2 < jobs_prev_12m)) from ar)
  )
  where is_staff()
$$;
grant execute on function agents_performance(int) to authenticated;

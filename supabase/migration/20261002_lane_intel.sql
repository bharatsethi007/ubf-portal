-- lane_intel: Freight Intelligence v2 for quotes.
-- Last N months only, split by load type, medians (not averages), sell + cost + GP,
-- customer history on the lane, similar past jobs by size.
-- plpgsql dynamic WHERE (no null-OR pattern). Staff only. Idempotent.
-- Idempotent. Safe to run once in Supabase SQL editor, or approve Claude applying it via MCP.

drop function if exists public.lane_intel(text,text,text,text,text,text,numeric,numeric,int);

create or replace function public.lane_intel(
  p_origin text, p_dest text, p_mode text,
  p_direction text default null, p_load_type text default null,
  p_customer text default null, p_weight_kg numeric default null,
  p_volume_m3 numeric default null, p_months int default 12
) returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_dir text := case when p_direction ilike 'exp%' then 'export' when p_direction ilike 'imp%' then 'import' end;
  v_load text := case when upper(p_load_type) in ('FCL','LCL') then upper(p_load_type) end;
  v_months int := greatest(1, least(coalesce(p_months, 12), 60));
  v_where text;
  v_out jsonb;
begin
  if not is_staff() then return null; end if;
  if p_origin is null or p_dest is null then return null; end if;

  v_where := format(
    's.origin = %L and s.destination = %L and s.mode ilike %L
     and coalesce(s.relevant_date, s.etd) between (now() - make_interval(months => %s))::date and (now() + interval ''60 days'')::date',
    p_origin, p_dest, p_mode, v_months);
  if v_dir is not null then v_where := v_where || format(' and s.direction = %L', v_dir); end if;
  if v_load is not null and lower(p_mode) = 'sea' then v_where := v_where || format(' and s.load_type = %L', v_load); end if;

  execute format($q$
    with lane as (
      select s.job_unique, s.job_no, s.customer_account_id, coalesce(s.relevant_date, s.etd) as d,
             s.weight_kg, s.volume_m3
      from shipments s where %1$s
    ),
    jc as (
      select c.job_unique, upper(c.charge_code) as code, c.description, c.sell, c.cost, c.profit
      from job_charges c join lane l on l.job_unique = c.job_unique
      where c.charge_code is not null
        and upper(c.charge_code) not in (select upper(charge_code) from charge_passthrough)
        and coalesce(abs(c.sell), 0) < 1000000
    ),
    n as (select count(*)::int as jobs from lane),
    per_job_code as (
      select job_unique, code, sum(sell) sell, sum(cost) cost, sum(profit) gp from jc group by 1, 2
    ),
    charges as (
      select p.code,
        (select mode() within group (order by j.description) from jc j where j.code = p.code) as erp_desc,
        count(*)::int as jobs_with,
        round(100.0 * count(*) / nullif((select jobs from n), 0))::int as pct,
        round(percentile_cont(.5) within group (order by p.sell)::numeric, 2) as med_sell,
        round(percentile_cont(.25) within group (order by p.sell)::numeric, 2) as p25_sell,
        round(percentile_cont(.75) within group (order by p.sell)::numeric, 2) as p75_sell,
        round(percentile_cont(.5) within group (order by p.cost)::numeric, 2) as med_cost,
        round(100.0 * sum(p.gp) / nullif(sum(p.sell), 0), 1) as gp_pct
      from per_job_code p where p.sell <> 0
      group by p.code
    ),
    job_tot as (
      select l.job_unique, l.job_no, l.customer_account_id, l.d, l.weight_kg, l.volume_m3,
             sum(j.sell) sell, sum(j.profit) gp
      from lane l join jc j on j.job_unique = l.job_unique
      group by 1, 2, 3, 4, 5, 6 having sum(j.sell) > 0
    )
    select jsonb_build_object(
      'jobs', (select jobs from n),
      'months', %2$s,
      'load_type', %3$L,
      'direction', %4$L,
      'totals', (select jsonb_build_object(
          'med_sell', round(percentile_cont(.5) within group (order by sell)::numeric, 0),
          'p25_sell', round(percentile_cont(.25) within group (order by sell)::numeric, 0),
          'p75_sell', round(percentile_cont(.75) within group (order by sell)::numeric, 0),
          'gp_pct', round(100.0 * sum(gp) / nullif(sum(sell), 0), 1),
          'gp_p25', round(percentile_cont(.25) within group (order by 100.0 * gp / nullif(sell, 0))::numeric, 1),
          'gp_p75', round(percentile_cont(.75) within group (order by 100.0 * gp / nullif(sell, 0))::numeric, 1)
        ) from job_tot),
      'charges', coalesce((select jsonb_agg(jsonb_build_object(
          'code', c.code,
          'description', coalesce(cc.description, c.erp_desc, c.code),
          'erp_description', c.erp_desc,
          'group', coalesce(cc.charge_group, null),
          'pct', c.pct, 'jobs_with', c.jobs_with,
          'med_sell', c.med_sell, 'p25_sell', c.p25_sell, 'p75_sell', c.p75_sell,
          'med_cost', c.med_cost, 'gp_pct', c.gp_pct
        ) order by c.pct desc, c.med_sell desc)
        from (select * from charges order by pct desc limit 20) c
        left join charge_codes cc on upper(cc.code) = c.code), '[]'::jsonb),
      'customer', case when %5$L is null then null else (select jsonb_build_object(
          'jobs', count(*),
          'last_date', max(d),
          'med_sell', round(percentile_cont(.5) within group (order by sell)::numeric, 0),
          'gp_pct', round(100.0 * sum(gp) / nullif(sum(sell), 0), 1),
          'codes', (select coalesce(jsonb_agg(distinct p.code), '[]'::jsonb) from per_job_code p
                     join job_tot t2 on t2.job_unique = p.job_unique where t2.customer_account_id = %5$L)
        ) from job_tot where customer_account_id = %5$L) end,
      'similar', coalesce((select jsonb_agg(x) from (
          select t.job_no, t.d as date, coalesce(cu.name, t.customer_account_id) as customer,
                 t.weight_kg, t.volume_m3, round(t.sell, 0) as sell,
                 round(100.0 * t.gp / nullif(t.sell, 0), 1) as gp_pct,
                 (t.customer_account_id = %5$L) as same_customer
          from job_tot t left join customers cu on cu.account_id = t.customer_account_id
          order by
            (t.customer_account_id is not distinct from %5$L) desc,
            case when %6$L::numeric is null and %7$L::numeric is null then 0
                 else abs(ln(greatest(coalesce(t.weight_kg, 1), 1) / greatest(coalesce(%6$L::numeric, t.weight_kg, 1), 1)))
                    + abs(ln(greatest(coalesce(t.volume_m3, .01), .01) / greatest(coalesce(%7$L::numeric, t.volume_m3, .01), .01))) end,
            t.d desc
          limit 5) x), '[]'::jsonb)
    )
  $q$, v_where, v_months, v_load, v_dir, p_customer, p_weight_kg, p_volume_m3)
  into v_out;

  return v_out;
end
$fn$;

revoke all on function public.lane_intel(text,text,text,text,text,text,numeric,numeric,int) from public, anon;
grant execute on function public.lane_intel(text,text,text,text,text,text,numeric,numeric,int) to authenticated;

notify pgrst, 'reload schema';

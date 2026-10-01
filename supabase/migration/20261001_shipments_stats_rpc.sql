-- Applied live via MCP 1 Oct 2026 (migration shipments_stats_rpc). Idempotent (create or replace).
-- KPI strip for Shipments page. Same scope as the Consols/Jobs tables:
-- consol-level dates mirror v_consols (houses inherit their consol's date, so HBLs with no house ETD still count).
create or replace function public.shipments_stats(
  p_module text, p_from date, p_to date, p_basis text default 'etd',
  p_port text default null, p_origin text default null, p_destination text default null, p_vessel text default null
) returns jsonb
language plpgsql stable
set search_path = public
as $fn$
declare
  v_len int := (p_to - p_from) + 1;
  v_pfrom date := p_from - ((p_to - p_from) + 1);
  v_where text := '';
  v_sql text;
  v_out jsonb;
begin
  if p_port is not null and p_port <> '' then
    v_where := v_where || format(' and (b.c_origin = %L or b.c_destination = %L)', p_port, p_port);
  end if;
  if p_origin is not null and btrim(p_origin) <> '' then
    v_where := v_where || format(' and b.c_origin ilike %L', btrim(p_origin) || '%');
  end if;
  if p_destination is not null and btrim(p_destination) <> '' then
    v_where := v_where || format(' and b.c_destination ilike %L', btrim(p_destination) || '%');
  end if;
  if p_vessel is not null and btrim(p_vessel) <> '' then
    v_where := v_where || format(' and b.c_vessel ilike %L', '%' || btrim(p_vessel) || '%');
  end if;

  v_sql := format($q$
    with raw as (
      select s.job_unique, s.consol_key, s.direction, s.customer_account_id,
             coalesce(s.weight_kg, 0) as weight_kg, coalesce(s.volume_m3, 0) as volume_m3,
             nullif(s.etd, '1899-12-30'::date) as etd, nullif(s.eta, '1899-12-30'::date) as eta,
             nullif(s.departed, '1899-12-30'::date) as departed, nullif(s.arrived, '1899-12-30'::date) as arrived,
             s.created_src::date as created, s.relevant_date, s.origin, s.destination, s.vessel_flight
      from shipments s
      where s.module = %1$L
        and s.created_src >= (least(%2$L::date, current_date) - interval '240 days')
    ),
    b as (
      select r.*,
        case when r.consol_key is null then coalesce(r.relevant_date, r.created)
             when r.direction = 'import' then coalesce(max(r.eta) over w, min(r.created) over w)
             else coalesce(min(r.etd) over w, min(r.created) over w) end as eff_etd,
        case when r.consol_key is null then r.created else min(r.created) over w end as eff_booked,
        case when r.consol_key is null then r.origin else min(r.origin) over w end as c_origin,
        case when r.consol_key is null then r.destination else max(r.destination) over w end as c_destination,
        case when r.consol_key is null then r.vessel_flight else max(r.vessel_flight) over w end as c_vessel,
        case when r.consol_key is null then r.etd else min(r.etd) over w end as c_etd,
        case when r.consol_key is null then r.eta else max(r.eta) over w end as c_eta,
        case when r.consol_key is null then r.departed else min(r.departed) over w end as c_departed,
        case when r.consol_key is null then r.arrived else max(r.arrived) over w end as c_arrived
      from raw r
      window w as (partition by r.consol_key)
    ),
    f as (
      select b.*, case when %4$L = 'booked' then b.eff_booked else b.eff_etd end as d
      from b where true %5$s
    ),
    cur as (select * from f where d between %2$L::date and %3$L::date),
    prev as (select * from f where d between %6$L::date and (%2$L::date - 1)),
    agg as (
      select 'cur' as k,
        count(distinct consol_key) as consols, count(*) as hbls,
        round(sum(weight_kg)::numeric, 1) as weight_kg, round(sum(volume_m3)::numeric, 2) as volume_m3,
        count(distinct customer_account_id) as customers,
        coalesce((select sum(t.teu) from mv_consol_teu t where t.consol_key in (select distinct consol_key from cur)), 0) as teu,
        count(*) filter (where etd is null) as hbl_no_etd
      from cur
      union all
      select 'prev', count(distinct consol_key), count(*),
        round(sum(weight_kg)::numeric, 1), round(sum(volume_m3)::numeric, 2),
        count(distinct customer_account_id),
        coalesce((select sum(t.teu) from mv_consol_teu t where t.consol_key in (select distinct consol_key from prev)), 0),
        count(*) filter (where etd is null)
      from prev
    ),
    days as (select generate_series(%2$L::date, %3$L::date, interval '1 day')::date as day),
    daily as (
      select days.day,
        count(distinct cur.consol_key) as consols, count(cur.job_unique) as hbls,
        coalesce(sum(cur.weight_kg), 0) as weight_kg, coalesce(sum(cur.volume_m3), 0) as volume_m3,
        count(distinct cur.customer_account_id) as customers
      from days left join cur on cur.d = days.day
      group by days.day order by days.day
    ),
    upcoming as (
      select count(distinct coalesce(consol_key, job_unique::text)) as n
      from f
      where (direction = 'export' and c_departed is null and c_etd between current_date and current_date + 7)
         or (direction = 'import' and c_arrived is null and c_eta between current_date and current_date + 7)
    ),
    late as (
      select count(distinct coalesce(consol_key, job_unique::text)) as n
      from f
      where (direction = 'export' and c_departed is null and c_etd between current_date - 30 and current_date - 1)
         or (direction = 'import' and c_arrived is null and c_eta between current_date - 30 and current_date - 1)
    )
    select jsonb_build_object(
      'cur', (select to_jsonb(a) - 'k' from agg a where k = 'cur'),
      'prev', (select to_jsonb(a) - 'k' from agg a where k = 'prev'),
      'series', jsonb_build_object(
        'consols', (select jsonb_agg(consols order by day) from daily),
        'hbls', (select jsonb_agg(hbls order by day) from daily),
        'weight_kg', (select jsonb_agg(weight_kg order by day) from daily),
        'volume_m3', (select jsonb_agg(volume_m3 order by day) from daily),
        'customers', (select jsonb_agg(customers order by day) from daily)
      ),
      'next7', (select n from upcoming),
      'overdue', (select n from late),
      'days', %7$s
    )
  $q$, p_module, p_from, p_to, coalesce(p_basis, 'etd'), v_where, v_pfrom, v_len);

  execute v_sql into v_out;
  return v_out;
end
$fn$;

grant execute on function public.shipments_stats(text, date, date, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';

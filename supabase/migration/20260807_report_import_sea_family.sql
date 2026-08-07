-- Import Sea reporting family (mode='sea', direction='import'), mirroring report_expsea_* with TEU + CBM.
-- TEU = per DISTINCT consol (avoids LCL house over-count); CBM = house sum(volume_m3).
-- Optional p_load_type ('FCL'|'LCL'|NULL).

create or replace function public.report_impsea_trend(
  p_from date, p_to date, p_destination text default null,
  p_customer text default null, p_consignee text default null, p_load_type text default null)
returns table(month date, masters bigint, houses bigint, teu numeric, cbm numeric, revenue numeric)
language sql stable as $$
  with base as (
    select s.job_unique, s.consol_key,
           date_trunc('month', coalesce(s.doc_date, s.etd))::date as month,
           s.master_bill, s.house_bill, s.volume_m3
    from public.shipments s
    where s.direction='import' and s.mode='sea'
      and coalesce(s.doc_date, s.etd) between p_from and p_to
      and (p_destination is null or s.destination = p_destination)
      and (p_customer is null or s.customer_account_id = p_customer)
      and (p_consignee is null or s.consignee_name = p_consignee)
      and (p_load_type is null or s.load_type = p_load_type)
  ),
  inv as (select i.job_unique, sum(i.amt_local) as rev from public.invoices i
          where i.job_unique in (select job_unique from base) group by i.job_unique),
  ct as (select c.consol_key,
           sum(case when c.container_size='20' then 1 when c.container_size in ('40','40HC') then 2 else 0 end) as teu
         from public.containers c
         where c.consol_key in (select consol_key from base where consol_key is not null)
         group by c.consol_key),
  month_teu as (select b.month, sum(ct.teu) as teu
         from (select distinct month, consol_key from base where consol_key is not null) b
         join ct on ct.consol_key = b.consol_key group by b.month),
  month_agg as (select b.month,
           count(distinct nullif(trim(b.master_bill),'')) as masters,
           count(distinct nullif(trim(b.house_bill),''))  as houses,
           coalesce(sum(coalesce(b.volume_m3,0)),0) as cbm,
           coalesce(sum(iv.rev),0) as revenue
         from base b left join inv iv on iv.job_unique = b.job_unique group by b.month)
  select ma.month, ma.masters, ma.houses, coalesce(mt.teu,0) as teu, ma.cbm, ma.revenue
  from month_agg ma left join month_teu mt using(month) order by ma.month;
$$;

create or replace function public.report_impsea_lanes(
  p_from date, p_to date, p_destination text default null,
  p_customer text default null, p_consignee text default null,
  p_load_type text default null, p_limit integer default 50)
returns table(origin text, destination text, masters bigint, houses bigint, teu numeric, cbm numeric, revenue numeric)
language sql stable as $$
  with base as (
    select s.job_unique, s.consol_key, s.origin, s.destination, s.master_bill, s.house_bill, s.volume_m3
    from public.shipments s
    where s.direction='import' and s.mode='sea'
      and coalesce(s.doc_date, s.etd) between p_from and p_to
      and s.origin is not null and s.destination is not null
      and (p_destination is null or s.destination = p_destination)
      and (p_customer is null or s.customer_account_id = p_customer)
      and (p_consignee is null or s.consignee_name = p_consignee)
      and (p_load_type is null or s.load_type = p_load_type)
  ),
  inv as (select i.job_unique, sum(i.amt_local) as rev from public.invoices i
          where i.job_unique in (select job_unique from base) group by i.job_unique),
  ct as (select c.consol_key,
           sum(case when c.container_size='20' then 1 when c.container_size in ('40','40HC') then 2 else 0 end) as teu
         from public.containers c
         where c.consol_key in (select consol_key from base where consol_key is not null)
         group by c.consol_key),
  lane_teu as (select b.origin, b.destination, sum(ct.teu) as teu
         from (select distinct origin, destination, consol_key from base where consol_key is not null) b
         join ct on ct.consol_key = b.consol_key group by b.origin, b.destination),
  lane_agg as (select b.origin, b.destination,
           count(distinct nullif(trim(b.master_bill),'')) as masters,
           count(distinct nullif(trim(b.house_bill),''))  as houses,
           coalesce(sum(coalesce(b.volume_m3,0)),0) as cbm,
           coalesce(sum(iv.rev),0) as revenue
         from base b left join inv iv on iv.job_unique = b.job_unique group by b.origin, b.destination)
  select la.origin, la.destination, la.masters, la.houses, coalesce(lt.teu,0) as teu, la.cbm, la.revenue
  from lane_agg la left join lane_teu lt on lt.origin = la.origin and lt.destination = la.destination
  order by (case when p_load_type='FCL' then coalesce(lt.teu,0)
                 when p_load_type='LCL' then la.cbm else la.houses::numeric end) desc
  limit p_limit;
$$;

create or replace function public.report_impsea_parties(
  p_from date, p_to date, p_destination text default null,
  p_customer text default null, p_consignee text default null,
  p_load_type text default null, p_limit integer default 50)
returns table(customer_account_id text, customer_name text, consignee_name text,
              masters bigint, houses bigint, teu numeric, cbm numeric, revenue numeric)
language sql stable as $$
  with base as (
    select s.job_unique, s.consol_key, s.customer_account_id, s.consignee_name,
           s.master_bill, s.house_bill, s.volume_m3
    from public.shipments s
    where s.direction='import' and s.mode='sea'
      and coalesce(s.doc_date, s.etd) between p_from and p_to
      and (p_destination is null or s.destination = p_destination)
      and (p_customer is null or s.customer_account_id = p_customer)
      and (p_consignee is null or s.consignee_name = p_consignee)
      and (p_load_type is null or s.load_type = p_load_type)
  ),
  inv as (select i.job_unique, sum(i.amt_local) as rev from public.invoices i
          where i.job_unique in (select job_unique from base) group by i.job_unique),
  ct as (select c.consol_key,
           sum(case when c.container_size='20' then 1 when c.container_size in ('40','40HC') then 2 else 0 end) as teu
         from public.containers c
         where c.consol_key in (select consol_key from base where consol_key is not null)
         group by c.consol_key),
  party_teu as (select b.customer_account_id, b.consignee_name, sum(ct.teu) as teu
         from (select distinct customer_account_id, consignee_name, consol_key from base where consol_key is not null) b
         join ct on ct.consol_key = b.consol_key group by b.customer_account_id, b.consignee_name),
  party_agg as (select b.customer_account_id, cu.name as customer_name, b.consignee_name,
           count(distinct nullif(trim(b.master_bill),'')) as masters,
           count(distinct nullif(trim(b.house_bill),''))  as houses,
           coalesce(sum(coalesce(b.volume_m3,0)),0) as cbm,
           coalesce(sum(iv.rev),0) as revenue
         from base b
         left join public.customers cu on cu.account_id = b.customer_account_id
         left join inv iv on iv.job_unique = b.job_unique
         group by b.customer_account_id, cu.name, b.consignee_name)
  select pa.customer_account_id, pa.customer_name, pa.consignee_name,
         pa.masters, pa.houses, coalesce(pt.teu,0) as teu, pa.cbm, pa.revenue
  from party_agg pa
  left join party_teu pt on pt.customer_account_id is not distinct from pa.customer_account_id
                        and pt.consignee_name is not distinct from pa.consignee_name
  order by (case when p_load_type='FCL' then coalesce(pt.teu,0)
                 when p_load_type='LCL' then pa.cbm else pa.houses::numeric end) desc
  limit p_limit;
$$;

create or replace function public.report_impsea_destinations(p_from date, p_to date, p_load_type text default null)
returns table(destination text, houses bigint) language sql stable as $$
  select s.destination, count(distinct nullif(trim(s.house_bill),'')) as houses
  from public.shipments s
  where s.direction='import' and s.mode='sea'
    and coalesce(s.doc_date, s.etd) between p_from and p_to and s.destination is not null
    and (p_load_type is null or s.load_type = p_load_type)
  group by s.destination order by houses desc;
$$;

create or replace function public.report_impsea_customers(p_from date, p_to date, p_load_type text default null)
returns table(customer_account_id text, customer_name text, houses bigint) language sql stable as $$
  select s.customer_account_id, c.name as customer_name, count(distinct nullif(trim(s.house_bill),'')) as houses
  from public.shipments s left join public.customers c on c.account_id = s.customer_account_id
  where s.direction='import' and s.mode='sea'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.customer_account_id is not null and trim(s.customer_account_id) <> ''
    and (p_load_type is null or s.load_type = p_load_type)
  group by s.customer_account_id, c.name order by houses desc;
$$;

create or replace function public.report_impsea_consignees(p_from date, p_to date, p_load_type text default null)
returns table(consignee_name text, houses bigint) language sql stable as $$
  select s.consignee_name, count(distinct nullif(trim(s.house_bill),'')) as houses
  from public.shipments s
  where s.direction='import' and s.mode='sea'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.consignee_name is not null and trim(s.consignee_name) <> ''
    and (p_load_type is null or s.load_type = p_load_type)
  group by s.consignee_name order by houses desc;
$$;

grant execute on function public.report_impsea_trend(date,date,text,text,text,text) to authenticated;
grant execute on function public.report_impsea_lanes(date,date,text,text,text,text,integer) to authenticated;
grant execute on function public.report_impsea_parties(date,date,text,text,text,text,integer) to authenticated;
grant execute on function public.report_impsea_destinations(date,date,text) to authenticated;
grant execute on function public.report_impsea_customers(date,date,text) to authenticated;
grant execute on function public.report_impsea_consignees(date,date,text) to authenticated;

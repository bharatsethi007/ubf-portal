-- Import Air reporting family (mode='air', direction='import'), mirroring report_expair_*.

create or replace function public.report_impair_trend(
  p_from date, p_to date, p_destination text default null,
  p_customer text default null, p_consignee text default null)
returns table(month date, masters bigint, houses bigint, gross_kg numeric, chargeable_kg numeric, revenue numeric)
language sql stable as $$
  select date_trunc('month', coalesce(s.doc_date, s.etd))::date as month,
         count(distinct nullif(trim(s.master_bill),'')) as masters,
         count(distinct nullif(trim(s.house_bill),''))  as houses,
         coalesce(sum(coalesce(s.weight_kg,0)),0) as gross_kg,
         coalesce(sum(greatest(coalesce(s.weight_kg,0), coalesce(s.volume_m3,0)*167)),0) as chargeable_kg,
         coalesce(sum((select sum(i.amt_local) from public.invoices i where i.job_unique = s.job_unique)),0) as revenue
  from public.shipments s
  where s.direction='import' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and (p_destination is null or s.destination = p_destination)
    and (p_customer is null or s.customer_account_id = p_customer)
    and (p_consignee is null or s.consignee_name = p_consignee)
  group by 1 order by 1;
$$;

create or replace function public.report_impair_lanes(
  p_from date, p_to date, p_destination text default null,
  p_customer text default null, p_consignee text default null, p_limit integer default 50)
returns table(origin text, destination text, masters bigint, houses bigint, gross_kg numeric, chargeable_kg numeric, revenue numeric)
language sql stable as $$
  select s.origin, s.destination,
         count(distinct nullif(trim(s.master_bill),'')) as masters,
         count(distinct nullif(trim(s.house_bill),''))  as houses,
         coalesce(sum(coalesce(s.weight_kg,0)),0) as gross_kg,
         coalesce(sum(greatest(coalesce(s.weight_kg,0), coalesce(s.volume_m3,0)*167)),0) as chargeable_kg,
         coalesce(sum((select sum(i.amt_local) from public.invoices i where i.job_unique = s.job_unique)),0) as revenue
  from public.shipments s
  where s.direction='import' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.origin is not null and s.destination is not null
    and (p_destination is null or s.destination = p_destination)
    and (p_customer is null or s.customer_account_id = p_customer)
    and (p_consignee is null or s.consignee_name = p_consignee)
  group by s.origin, s.destination order by houses desc limit p_limit;
$$;

create or replace function public.report_impair_parties(
  p_from date, p_to date, p_destination text default null,
  p_customer text default null, p_consignee text default null, p_limit integer default 50)
returns table(customer_account_id text, customer_name text, consignee_name text, masters bigint, houses bigint, gross_kg numeric, chargeable_kg numeric, revenue numeric)
language sql stable as $$
  select s.customer_account_id, c.name as customer_name, s.consignee_name,
         count(distinct nullif(trim(s.master_bill),'')) as masters,
         count(distinct nullif(trim(s.house_bill),''))  as houses,
         coalesce(sum(coalesce(s.weight_kg,0)),0) as gross_kg,
         coalesce(sum(greatest(coalesce(s.weight_kg,0), coalesce(s.volume_m3,0)*167)),0) as chargeable_kg,
         coalesce(sum((select sum(i.amt_local) from public.invoices i where i.job_unique = s.job_unique)),0) as revenue
  from public.shipments s
  left join public.customers c on c.account_id = s.customer_account_id
  where s.direction='import' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and (p_destination is null or s.destination = p_destination)
    and (p_customer is null or s.customer_account_id = p_customer)
    and (p_consignee is null or s.consignee_name = p_consignee)
  group by s.customer_account_id, c.name, s.consignee_name order by houses desc limit p_limit;
$$;

create or replace function public.report_impair_destinations(p_from date, p_to date)
returns table(destination text, houses bigint)
language sql stable as $$
  select s.destination, count(distinct nullif(trim(s.house_bill),'')) as houses
  from public.shipments s
  where s.direction='import' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.destination is not null
  group by s.destination order by houses desc;
$$;

create or replace function public.report_impair_customers(p_from date, p_to date)
returns table(customer_account_id text, customer_name text, houses bigint)
language sql stable as $$
  select s.customer_account_id, c.name as customer_name,
         count(distinct nullif(trim(s.house_bill),'')) as houses
  from public.shipments s
  left join public.customers c on c.account_id = s.customer_account_id
  where s.direction='import' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.customer_account_id is not null and trim(s.customer_account_id) <> ''
  group by s.customer_account_id, c.name order by houses desc;
$$;

create or replace function public.report_impair_consignees(p_from date, p_to date)
returns table(consignee_name text, houses bigint)
language sql stable as $$
  select s.consignee_name, count(distinct nullif(trim(s.house_bill),'')) as houses
  from public.shipments s
  where s.direction='import' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.consignee_name is not null and trim(s.consignee_name) <> ''
  group by s.consignee_name order by houses desc;
$$;

grant execute on function public.report_impair_trend(date,date,text,text,text) to authenticated;
grant execute on function public.report_impair_lanes(date,date,text,text,text,integer) to authenticated;
grant execute on function public.report_impair_parties(date,date,text,text,text,integer) to authenticated;
grant execute on function public.report_impair_destinations(date,date) to authenticated;
grant execute on function public.report_impair_customers(date,date) to authenticated;
grant execute on function public.report_impair_consignees(date,date) to authenticated;

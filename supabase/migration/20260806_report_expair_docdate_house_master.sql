drop function if exists public.report_expair_trend(date,date,text);
drop function if exists public.report_expair_lanes(date,date,text,integer);
drop function if exists public.report_expair_parties(date,date,text,integer);
drop function if exists public.report_expair_destinations(date,date);

create function public.report_expair_trend(p_from date, p_to date, p_destination text default null)
returns table(month date, masters bigint, houses bigint, gross_kg numeric, chargeable_kg numeric, revenue numeric)
language sql stable as $$
  select date_trunc('month', coalesce(s.doc_date, s.etd))::date as month,
         count(distinct nullif(trim(s.master_bill),'')) as masters,
         count(distinct nullif(trim(s.house_bill),''))  as houses,
         coalesce(sum(coalesce(s.weight_kg,0)),0) as gross_kg,
         coalesce(sum(greatest(coalesce(s.weight_kg,0), coalesce(s.volume_m3,0)*167)),0) as chargeable_kg,
         coalesce(sum((select sum(i.amt_local) from public.invoices i where i.job_unique = s.job_unique)),0) as revenue
  from public.shipments s
  where s.direction='export' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and (p_destination is null or s.destination = p_destination)
  group by 1 order by 1;
$$;

create function public.report_expair_lanes(p_from date, p_to date, p_destination text default null, p_limit integer default 50)
returns table(origin text, destination text, masters bigint, houses bigint, gross_kg numeric, chargeable_kg numeric, revenue numeric)
language sql stable as $$
  select s.origin, s.destination,
         count(distinct nullif(trim(s.master_bill),'')) as masters,
         count(distinct nullif(trim(s.house_bill),''))  as houses,
         coalesce(sum(coalesce(s.weight_kg,0)),0) as gross_kg,
         coalesce(sum(greatest(coalesce(s.weight_kg,0), coalesce(s.volume_m3,0)*167)),0) as chargeable_kg,
         coalesce(sum((select sum(i.amt_local) from public.invoices i where i.job_unique = s.job_unique)),0) as revenue
  from public.shipments s
  where s.direction='export' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.origin is not null and s.destination is not null
    and (p_destination is null or s.destination = p_destination)
  group by s.origin, s.destination order by houses desc limit p_limit;
$$;

create function public.report_expair_parties(p_from date, p_to date, p_destination text default null, p_limit integer default 50)
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
  where s.direction='export' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and (p_destination is null or s.destination = p_destination)
  group by s.customer_account_id, c.name, s.consignee_name order by houses desc limit p_limit;
$$;

create function public.report_expair_destinations(p_from date, p_to date)
returns table(destination text, houses bigint)
language sql stable as $$
  select s.destination, count(distinct nullif(trim(s.house_bill),'')) as houses
  from public.shipments s
  where s.direction='export' and s.mode='air'
    and coalesce(s.doc_date, s.etd) between p_from and p_to
    and s.destination is not null
  group by s.destination order by houses desc;
$$;

grant execute on function public.report_expair_trend(date,date,text) to authenticated;
grant execute on function public.report_expair_lanes(date,date,text,integer) to authenticated;
grant execute on function public.report_expair_parties(date,date,text,integer) to authenticated;
grant execute on function public.report_expair_destinations(date,date) to authenticated;

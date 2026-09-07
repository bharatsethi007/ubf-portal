-- 20260907_marketing_reports.sql
-- do not re-run, applied via MCP

-- View: deduped sea-export accounts, last 6 months, best email
drop view if exists public.v_sea_export_marketing;
create view public.v_sea_export_marketing
with (security_invoker = true) as
with ex as (
  select customer_account_id as account_id,
         count(*)                          as shipments_6mo,
         max(coalesce(relevant_date, etd)) as last_shipment,
         min(coalesce(relevant_date, etd)) as first_shipment
  from public.shipments
  where mode = 'sea' and direction = 'export'
    and coalesce(relevant_date, etd) >= current_date - interval '6 months'
  group by customer_account_id
),
prime as (
  select distinct on (account_id) account_id, email, first_name, last_name
  from public.contacts
  where email is not null and email <> ''
  order by account_id, is_prime desc nulls last, id
)
select c.account_id,
       c.name,
       coalesce(nullif(c.email,''), p.email)                 as email,
       (nullif(c.email,'') is not null)                      as email_from_customer,
       (nullif(c.email,'') is null and p.email is not null)  as email_from_contact,
       p.first_name, p.last_name,
       c.city, c.country, c.sales_manager,
       ex.shipments_6mo, ex.first_shipment, ex.last_shipment,
       (coalesce(nullif(c.email,''), p.email) is not null)   as has_email
from ex
join public.customers c on c.account_id = ex.account_id
left join prime p on p.account_id = ex.account_id
where coalesce(c.closed, false) = false;
grant select on public.v_sea_export_marketing to authenticated;

-- RPC: house-level shipment rows with resolved party emails
drop function if exists public.marketing_shipment_parties(text, text, int);
create or replace function public.marketing_shipment_parties(
  p_mode text, p_direction text, p_months int default 6
)
returns table (
  job_no text, house_bill text, shipment_date date, origin text, destination text,
  shipper_name text, consignee_name text,
  customer_account_id text, customer_name text, customer_email text,
  shipper_email text, consignee_email text,
  os_agent_code text, agent_name text, agent_email text
)
language plpgsql stable security definer set search_path = public as $$
declare v_sql text;
begin
  if not is_staff() then raise exception 'staff only'; end if;
  v_sql := $q$
    select s.job_no::text, s.house_bill, coalesce(s.relevant_date, s.etd) as shipment_date,
           s.origin, s.destination, s.shipper_name, s.consignee_name,
           s.customer_account_id, c.name as customer_name,
           coalesce(nullif(c.email,''), pc.email) as customer_email,
           sc.email as shipper_email, cc.email as consignee_email,
           s.os_agent_code, a.name as agent_name, ac.email as agent_email
    from shipments s
    left join customers c on c.account_id = s.customer_account_id
    left join lateral (select email from contacts where account_id = s.customer_account_id and email <> '' order by is_prime desc nulls last, id limit 1) pc on true
    left join lateral (select email from customers m where upper(btrim(m.name)) = upper(btrim(s.shipper_name)) and m.email <> '' limit 1) sc on true
    left join lateral (select email from customers m where upper(btrim(m.name)) = upper(btrim(s.consignee_name)) and m.email <> '' limit 1) cc on true
    left join agents a on a.erp_account_code = s.os_agent_code
    left join lateral (select email from agent_contacts x where x.agent_id = a.id and x.email <> '' order by x.is_prime desc nulls last, x.id limit 1) ac on true
    where coalesce(s.relevant_date, s.etd) >= current_date - make_interval(months => $1)
  $q$;
  if p_mode is not null and p_mode <> '' then v_sql := v_sql || ' and s.mode = ' || quote_literal(p_mode); end if;
  if p_direction is not null and p_direction <> '' then v_sql := v_sql || ' and s.direction = ' || quote_literal(p_direction); end if;
  v_sql := v_sql || ' order by shipment_date desc';
  return query execute v_sql using p_months;
end; $$;
revoke all on function public.marketing_shipment_parties(text, text, int) from public, anon;
grant execute on function public.marketing_shipment_parties(text, text, int) to authenticated;
notify pgrst, 'reload schema';

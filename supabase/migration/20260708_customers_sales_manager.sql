-- Sales rep code from TradeWindow ACC_CLIENTS.SALESAREA (STAFF join deferred).
alter table public.customers
  add column if not exists sales_manager text;

comment on column public.customers.sales_manager is
  'TradeWindow ACC_CLIENTS.SALESAREA — operator code (e.g. VINEET, JAY). Names resolved later.';

drop view if exists public.v_customer_stats;

create view public.v_customer_stats as
select
  c.account_id,
  c.name,
  c.branch,
  c.is_importer,
  c.is_exporter,
  c.closed,
  c.sales_manager,
  count(s.job_unique) as total_shipments,
  count(s.job_unique) filter (where s.status = 'In transit') as in_transit,
  count(s.job_unique) filter (where s.status like 'Arrived%') as arrived,
  count(s.job_unique) filter (where s.direction = 'import') as imports,
  count(s.job_unique) filter (where s.direction = 'export') as exports,
  count(s.job_unique) filter (where s.relevant_date >= date_trunc('month', current_date::timestamp with time zone)) as this_month,
  max(s.relevant_date) as last_activity,
  (select count(*) from contacts ct where ct.account_id = c.account_id) as contact_count,
  exists (select 1 from portal_users pu where pu.account_id = c.account_id) as has_portal_access
from customers c
left join shipments s on s.customer_account_id = c.account_id
group by
  c.account_id, c.name, c.branch, c.is_importer, c.is_exporter, c.closed, c.sales_manager;

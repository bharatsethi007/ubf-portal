-- Applied live via MCP 1 Oct 2026 (migrations portal_created_customers + portal_customer_id_prefix). Idempotent.
alter table public.customers
  add column if not exists source text not null default 'erp',
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customers_source_check') then
    alter table public.customers add constraint customers_source_check check (source in ('erp', 'portal'));
  end if;
end $$;

create sequence if not exists public.portal_customer_seq start 1;

-- Staff-only create. account_id = P-00001... ('P-' never used by ERP codes).
create or replace function public.create_portal_customer(
  p_name text,
  p_contact text default null, p_email text default null, p_phone text default null,
  p_address1 text default null, p_city text default null, p_postcode text default null, p_country text default null,
  p_is_importer boolean default false, p_is_exporter boolean default false
) returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_name text := upper(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
  v_dup text;
  v_id text;
  v_row customers;
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(v_name) < 2 then raise exception 'Customer name is required'; end if;

  select account_id into v_dup from customers
   where upper(btrim(name)) = v_name and coalesce(closed, false) = false limit 1;
  if v_dup is not null then
    raise exception 'Customer already exists (%)', v_dup using errcode = '23505';
  end if;

  v_id := 'P-' || lpad(nextval('portal_customer_seq')::text, 5, '0');
  insert into customers (account_id, name, contact, email, phone, address1, city, postcode, country,
                         is_importer, is_exporter, closed, source, created_by, created_at, synced_at)
  values (v_id, v_name, nullif(btrim(p_contact), ''), nullif(lower(btrim(p_email)), ''), nullif(btrim(p_phone), ''),
          nullif(upper(btrim(p_address1)), ''), nullif(upper(btrim(p_city)), ''), nullif(btrim(p_postcode), ''),
          nullif(upper(btrim(p_country)), ''), coalesce(p_is_importer, false), coalesce(p_is_exporter, false),
          false, 'portal', auth.uid(), now(), null)
  returning * into v_row;
  return to_jsonb(v_row);
end
$fn$;

revoke all on function public.create_portal_customer(text, text, text, text, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.create_portal_customer(text, text, text, text, text, text, text, text, boolean, boolean) to authenticated;

create or replace view public.v_customer_stats with (security_invoker = true) as
 SELECT c.account_id, c.name, c.branch, c.is_importer, c.is_exporter, c.closed, c.sales_manager,
    count(s.job_unique) AS total_shipments,
    count(s.job_unique) FILTER (WHERE (s.status = 'In transit'::text)) AS in_transit,
    count(s.job_unique) FILTER (WHERE (s.status ~~ 'Arrived%'::text)) AS arrived,
    count(s.job_unique) FILTER (WHERE (s.direction = 'import'::text)) AS imports,
    count(s.job_unique) FILTER (WHERE (s.direction = 'export'::text)) AS exports,
    count(s.job_unique) FILTER (WHERE (s.relevant_date >= date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))) AS this_month,
    max(s.relevant_date) AS last_activity,
    ( SELECT count(*) AS count FROM contacts ct WHERE (ct.account_id = c.account_id)) AS contact_count,
    (EXISTS ( SELECT 1 FROM portal_users pu WHERE (pu.account_id = c.account_id))) AS has_portal_access,
    c.source
   FROM ((customers c
     LEFT JOIN agents a ON ((a.erp_account_code = c.account_id)))
     LEFT JOIN shipments s ON ((s.customer_account_id = c.account_id)))
  WHERE (a.erp_account_code IS NULL)
  GROUP BY c.account_id, c.name, c.branch, c.is_importer, c.is_exporter, c.closed, c.sales_manager, c.source;

notify pgrst, 'reload schema';

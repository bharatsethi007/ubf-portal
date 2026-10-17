-- M4d Branding per company/branch + branch view filter.
--  1. Company/branch branding data (legal + trading name, address, phone, email, tax, bank,
--     terms) seeded for NZ/AKL from what the PDFs print today. get_branding() serves it.
--  2. Branch view: staff can narrow lists to one branch of their company (CargoWise style).
--     staff_companies.view_branch (null = all branches). New records go to that branch.
-- Idempotent. Safe to re-run.

begin;

-- 1. Branding columns ----------------------------------------------------------
alter table public.companies add column if not exists trading_name   text;
alter table public.companies add column if not exists website        text;
alter table public.companies add column if not exists terms_url      text;
alter table public.companies add column if not exists customs_code   text;
alter table public.companies add column if not exists remit_to       text;
alter table public.companies add column if not exists bank_name      text;
alter table public.companies add column if not exists bank_swift     text;
alter table public.companies add column if not exists bank_accounts  text[] not null default '{}';
alter table public.companies add column if not exists payment_notes  text[] not null default '{}';
alter table public.companies add column if not exists invoice_queries text;
alter table public.companies add column if not exists invoice_terms  text;
alter table public.branches  add column if not exists sales_email    text;

update public.companies set
  trading_name   = coalesce(trading_name, 'UB Freight Ltd'),
  legal_name     = coalesce(legal_name, 'UB Freight Limited'),
  tax_number     = coalesce(tax_number, '79-129-984'),
  website        = coalesce(website, 'ubfreight.com'),
  terms_url      = coalesce(terms_url, 'https://www.ubfreight.com/terms-and-conditions/'),
  customs_code   = coalesce(customs_code, 'CCA 13592F'),
  remit_to       = coalesce(remit_to, 'UB FREIGHT LIMITED, 173 MONTGOMERIE ROAD, AIRPORT OAKS, AUCKLAND, NEW ZEALAND'),
  bank_name      = coalesce(bank_name, 'ASB'),
  bank_swift     = coalesce(bank_swift, 'ASBBNZ2A'),
  bank_accounts  = case when bank_accounts = '{}' then array[
      'NZD payments to 123-062-0702589-00', 'USD payments to 26227915-(USD)-39',
      'AUD payments to 26963830-(AUD)-26', 'EUR payments to 26931548-(EUR)-27'] else bank_accounts end,
  payment_notes  = case when payment_notes = '{}' then array[
      'Payments with credit card will incur a surcharge of 3%.',
      'NZ Customs levies are to be paid upfront. MPI charges will follow, if applicable.'] else payment_notes end,
  invoice_queries = coalesce(invoice_queries, 'All queries must be raised within 7 days of receipt of this invoice.'),
  invoice_terms  = coalesce(invoice_terms,
      'All business transacted is subject to the Company''s Standard Trading Conditions of Contract, a copy of which is available upon request, '
   || 'and which, in certain circumstances, exclude the Company''s liability and include certain indemnities which benefit the Company. E & O E.')
where code = 'NZ';

update public.companies set trading_name = coalesce(trading_name, 'UB Freight (Fiji) Pte Limited'),
  legal_name = coalesce(legal_name, 'UB Freight (Fiji) Pte Limited'), website = coalesce(website, 'ubfreight.com')
where code = 'FJ';
update public.companies set trading_name = coalesce(trading_name, 'UB Freight Australia'),
  website = coalesce(website, 'ubfreight.com')
where code = 'AU';

update public.branches set
  address     = coalesce(address, E'173 Montgomerie Road\nAirport Oaks, Auckland 2022, New Zealand'),
  phone       = coalesce(phone, '+64 9 966 3850'),
  email       = coalesce(email, 'info@ubfreight.com'),
  sales_email = coalesce(sales_email, 'salessupport.nz@ubfreight.com')
where code = 'AKL';

-- Everything a document needs, for a record's company + branch (defaults: who is asking).
create or replace function public.get_branding(p_company text default null, p_branch text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with c as (select * from companies where code = coalesce(p_company, current_company())),
       b as (select * from branches
             where code = coalesce(p_branch,
                     case when coalesce(p_company, current_company()) = current_company() then current_branch() end,
                     (select x.code from branches x, c where x.company_id = c.code
                       order by x.is_active desc, x.sort_order limit 1)))
  select jsonb_build_object(
    'company', c.code, 'branch', b.code,
    'legal_name', coalesce(c.legal_name, c.trading_name, c.name),
    'trading_name', coalesce(c.trading_name, c.legal_name, c.name),
    'address', coalesce(b.address, ''), 'phone', coalesce(b.phone, ''), 'email', coalesce(b.email, ''),
    'sales_email', coalesce(b.sales_email, b.email, ''),
    'tax_label', coalesce(c.tax_label, 'GST'), 'tax_number', coalesce(c.tax_number, ''),
    'website', coalesce(c.website, ''), 'terms_url', coalesce(c.terms_url, ''),
    'customs_code', coalesce(c.customs_code, ''), 'currency', c.base_currency,
    'remit_to', coalesce(c.remit_to, ''), 'bank_name', coalesce(c.bank_name, ''), 'bank_swift', coalesce(c.bank_swift, ''),
    'bank_accounts', to_jsonb(c.bank_accounts), 'payment_notes', to_jsonb(c.payment_notes),
    'invoice_queries', coalesce(c.invoice_queries, ''), 'invoice_terms', coalesce(c.invoice_terms, ''))
  from c left join b on true;
$$;
grant execute on function public.get_branding(text, text) to authenticated;

-- 2. Branch view filter ------------------------------------------------------------
alter table public.staff_companies add column if not exists view_branch text references public.branches(code);

create or replace function public.my_view_branch() returns text
language sql stable security definer set search_path = public as $$
  select sc.view_branch from staff_companies sc
  where sc.user_id = auth.uid() and sc.is_default and sc.access = 'full' limit 1;
$$;
grant execute on function public.my_view_branch() to authenticated;

-- New records go to the branch being viewed, else home branch.
create or replace function public.current_branch() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(sc.view_branch, sc.home_branch) from staff_companies sc
      where sc.user_id = auth.uid() and sc.company_id = current_company()
        and coalesce(sc.view_branch, sc.home_branch) is not null limit 1),
    (select b.code from branches b where b.company_id = current_company()
      order by b.is_active desc, b.sort_order, b.code limit 1),
    'AKL');
$$;

create or replace function public.set_my_branch(p_branch text) returns text
language plpgsql security definer set search_path = public as $$
declare v_company text := current_company();
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_branch is not null and not exists (select 1 from branches where code = p_branch and company_id = v_company) then
    raise exception 'branch % is not in company %', p_branch, v_company;
  end if;
  update staff_companies set view_branch = p_branch
  where user_id = auth.uid() and company_id = v_company;
  return p_branch;
end $$;
grant execute on function public.set_my_branch(text) to authenticated;

create or replace function public.my_company_context() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'current', (select sc.company_id from staff_companies sc
                 where sc.user_id = auth.uid() and sc.is_default and sc.access = 'full' limit 1),
    'view_branch', my_view_branch(),
    'is_admin', is_admin(),
    'is_super_admin', is_super_admin(),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name,
                   'is_active', c.is_active, 'currency', c.base_currency) order by c.sort_order)
                 from companies c where c.code in (select my_companies())), '[]'::jsonb),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name,
                   'is_active', b.is_active) order by b.sort_order)
                 from branches b where b.company_id = (select sc.company_id from staff_companies sc
                   where sc.user_id = auth.uid() and sc.is_default and sc.access = 'full' limit 1)), '[]'::jsonb));
$$;

-- Lists hide other branches while a branch is picked (reads only; writes unaffected).
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'branch_id'
      and c.table_name in (select company_tables())
  loop
    execute format('drop policy if exists zz_branch_view on public.%I', t);
    execute format($p$create policy zz_branch_view on public.%I as restrictive for select to authenticated
      using ((select public.my_view_branch()) is null or branch_id = (select public.my_view_branch()))$p$, t);
  end loop;
end $$;

-- Scoped views (server functions) follow the branch view too.
create or replace function public.sync_scoped_views() returns integer
language plpgsql security definer set search_path = public as $$
declare t text; n int := 0; pred text;
begin
  for t in select company_tables() loop
    pred := 'company_id in (select public.scope_companies())';
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'branch_id') then
      pred := pred || ' and ((select public.my_view_branch()) is null or branch_id = (select public.my_view_branch()))';
    end if;
    begin
      execute format('create or replace view scoped.%I as select * from public.%I where %s', t, t, pred);
    exception when others then
      execute format('drop view if exists scoped.%I', t);
      execute format('create view scoped.%I as select * from public.%I where %s', t, t, pred);
    end;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Switching company clears the branch view.
create or replace function public.set_my_company(p_company text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  if p_company is not null and p_company not in (select my_companies()) then
    raise exception 'no access to company %', p_company;
  end if;
  if p_company is not null and not exists (
       select 1 from staff_companies where user_id = auth.uid() and company_id = p_company) then
    insert into staff_companies (user_id, company_id, access, is_default)
    values (auth.uid(), p_company, 'full', false);
  end if;
  update staff_companies set is_default = false, view_branch = null where user_id = auth.uid() and is_default;
  if p_company is not null then
    update staff_companies set is_default = true, view_branch = null where user_id = auth.uid() and company_id = p_company;
  end if;
  return p_company;
end $$;

select public.apply_company_scope();

commit;

notify pgrst, 'reload schema';

-- Verify:
-- select get_branding('NZ', 'AKL');

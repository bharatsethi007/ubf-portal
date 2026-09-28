-- 20260929_portal_rls_active_only.sql
-- Portal access must stop the moment a portal user is revoked.
-- 1) my_account_id() only returns an account for ACTIVE portal users.
-- 2) Policies that queried portal_users directly now go through my_account_id().

create or replace function public.my_account_id()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select account_id
    from portal_users
   where user_id = auth.uid()
     and status = 'active';
$$;

drop policy if exists own_contacts on public.contacts;
create policy own_contacts on public.contacts
  for select using (account_id = public.my_account_id());

drop policy if exists own_customer on public.customers;
create policy own_customer on public.customers
  for select using (account_id = public.my_account_id());

drop policy if exists own_invoices on public.invoices;
create policy own_invoices on public.invoices
  for select using (account_id = public.my_account_id());

drop policy if exists own_shipments on public.shipments;
create policy own_shipments on public.shipments
  for select using (customer_account_id = public.my_account_id());

drop policy if exists own_containers on public.containers;
create policy own_containers on public.containers
  for select using (
    exists (
      select 1 from public.shipments sh
       where sh.consol_key = containers.consol_key
         and sh.customer_account_id = public.my_account_id()
    )
  );

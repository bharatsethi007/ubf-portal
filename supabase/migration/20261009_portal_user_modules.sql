-- Portal user module access (9 Oct 2026). APPLIED via Supabase SQL Editor. Repo parity only: do not re-run.
-- Admins see every module. Members see only the modules in portal_users.modules.
-- Enforced in the database: every module RPC, view and RLS policy resolves the account through
-- portal_account_for(<module>), which returns null when the caller lacks the module.
-- Shipments, Home, Messages and Settings are core and always on.

-- 1. Column
alter table public.portal_users add column if not exists modules text[]
  not null default array['bookings','rates','products','analytics','billing']::text[];
alter table public.portal_users drop constraint if exists portal_users_modules_check;
alter table public.portal_users add constraint portal_users_modules_check
  check (modules <@ array['bookings','rates','products','analytics','billing']::text[]);

-- 2. Helpers
create or replace function public.portal_user_can(p_user uuid, p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.portal_users u
                  where u.user_id = p_user and u.status = 'active'
                    and (u.role = 'admin' or p_module = any (u.modules)))
$$;

create or replace function public.portal_can(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal_user_can(auth.uid(), p_module)
$$;

-- Account id for the caller when they hold ANY of the given modules, else null.
create or replace function public.portal_account_for(variadic p_modules text[])
returns text language sql stable security definer set search_path = public as $$
  select u.account_id from public.portal_users u
   where u.user_id = auth.uid() and u.status = 'active'
     and (u.role = 'admin' or u.modules && p_modules)
$$;

-- Notification kinds tied to a module. Null = core, everyone gets it.
create or replace function public.portal_kind_module(p_kind text)
returns text language sql immutable as $$
  select case p_kind when 'invoice_issued' then 'billing' when 'quote_ready' then 'rates' end
$$;

create or replace function public.portal_user_sees_kind(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal_kind_module(p_kind) is null or public.portal_user_can(p_user, public.portal_kind_module(p_kind))
$$;

-- Caller-only wrapper for RLS (policies run as the caller).
create or replace function public.portal_sees_kind(p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal_user_sees_kind(auth.uid(), p_kind)
$$;

revoke all on function public.portal_user_can(uuid, text) from public, anon, authenticated;
revoke all on function public.portal_user_sees_kind(uuid, text) from public, anon, authenticated;
grant execute on function public.portal_can(text) to authenticated;
grant execute on function public.portal_sees_kind(text) to authenticated;
grant execute on function public.portal_account_for(text[]) to authenticated;

-- 3. Rewrite module RPCs: my_account_id() -> portal_account_for(<modules>)
do $$
declare
  r record;
  def text;
  map jsonb := jsonb_build_object(
    'portal_billing', '''billing''', 'portal_statement', '''billing''',
    'portal_invoice_detail', '''billing''', 'portal_invoice_document', '''billing''',
    'portal_search_rates', '''rates''', 'portal_rate_option', '''rates''',
    'portal_request_quote', '''rates''', 'portal_quote_respond', '''rates''',
    'portal_analytics_v2', '''analytics''',
    'portal_supply_chain', '''products''', 'portal_import_products', '''products''', 'portal_import_po_lines', '''products''',
    'portal_booking_get', '''bookings''', 'portal_booking_update', '''bookings''',
    'portal_request_booking', '''bookings'', ''rates''');
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace and map ? p.proname loop
    def := pg_get_functiondef(r.oid);
    if position('my_account_id()' in def) > 0 then
      execute replace(def, 'my_account_id()', 'portal_account_for(' || (map ->> r.proname) || ')');
    end if;
  end loop;
end $$;

-- 4. Views
do $$
declare
  r record;
  def text;
  map jsonb := jsonb_build_object('portal_invoices', 'billing', 'portal_quotes', 'rates', 'portal_quote_offers', 'rates');
begin
  for r in select c.oid, c.relname from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' and map ? c.relname loop
    def := pg_get_viewdef(r.oid);
    if position('my_account_id()' in def) > 0 then
      execute format('create or replace view public.%I as %s', r.relname,
        replace(def, 'my_account_id()', format('portal_account_for(%L)', map ->> r.relname)));
    end if;
  end loop;

  -- Quoted price on bookings only for Rates users.
  def := pg_get_viewdef('public.portal_bookings'::regclass);
  if position('portal_can(''rates''' in def) = 0 then
    execute 'create or replace view public.portal_bookings as ' ||
      replace(def, E'    quoted_rate,\n', E'    CASE WHEN portal_can(''rates''::text) THEN quoted_rate END AS quoted_rate,\n');
  end if;
end $$;

-- 5. RLS: products tables, portal booking insert, notifications
drop policy if exists own_rows on public.portal_products;
create policy own_rows on public.portal_products for all to authenticated
  using (account_id = portal_account_for('products')) with check (account_id = portal_account_for('products'));
drop policy if exists own_rows on public.portal_purchase_orders;
create policy own_rows on public.portal_purchase_orders for all to authenticated
  using (account_id = portal_account_for('products')) with check (account_id = portal_account_for('products'));
drop policy if exists own_rows on public.portal_po_lines;
create policy own_rows on public.portal_po_lines for all to authenticated
  using (account_id = portal_account_for('products')) with check (account_id = portal_account_for('products'));
drop policy if exists own_rows on public.portal_po_allocations;
create policy own_rows on public.portal_po_allocations for all to authenticated
  using (account_id = portal_account_for('products'))
  with check (account_id = portal_account_for('products')
              and exists (select 1 from public.portal_shipments ps where ps.job_unique = portal_po_allocations.job_unique));

drop policy if exists portal_insert_bookings on public.bookings;
create policy portal_insert_bookings on public.bookings for insert to public
  with check (account_id = portal_account_for('bookings', 'rates') and source = 'customer_portal' and status = 'new');

drop policy if exists own_read on public.portal_notifications;
create policy own_read on public.portal_notifications for select to authenticated
  using ((account_id = my_account_id() and public.portal_sees_kind(kind)) or is_staff());

-- 6. Email + WhatsApp outboxes skip kinds the person can't see
do $$
declare
  f text;
  def text;
begin
  foreach f in array array['portal_notify_outbox', 'portal_wa_outbox'] loop
    def := pg_get_functiondef(('public.' || f)::regproc);
    if position('portal_user_sees_kind' in def) = 0 then
      execute replace(def, 'not (n.kind = any (r.off_))',
                      'not (n.kind = any (r.off_)) and public.portal_user_sees_kind(r.user_id, n.kind)');
    end if;
  end loop;
end $$;

-- 7. Team list carries modules
create or replace function public.portal_team_list()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select account_id, role, modules from public.portal_users where user_id = auth.uid() and status = 'active')
  select jsonb_build_object(
    'my_role', (select role from me),
    'my_modules', (select to_jsonb(modules) from me),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', u.user_id, 'email', u.email, 'name', u.display_name, 'phone', u.phone, 'role', u.role, 'status', u.status,
        'modules', to_jsonb(u.modules),
        'last_login_at', u.last_login_at, 'activated_at', u.activated_at, 'created_at', u.created_at,
        'is_me', u.user_id = auth.uid(),
        'invited_by', case when exists (select 1 from public.staff_users s where s.user_id = u.invited_by) then 'UB Freight'
                           else (select coalesce(i.display_name, i.email) from public.portal_users i where i.user_id = u.invited_by) end,
        'invite_expires_at', (select max(t.expires_at) from public.portal_invite_tokens t where t.user_id = u.user_id and t.used_at is null)
      ) order by (u.status = 'revoked'), (u.role = 'admin') desc, coalesce(u.display_name, u.email))
      from public.portal_users u join me on me.account_id = u.account_id), '[]'::jsonb)
  )
  where exists (select 1 from me)
$$;

-- 8. Staff console can set a portal user's modules
create or replace function public.staff_set_portal_modules(p_user uuid, p_modules text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v text[];
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct m order by m), '{}') into v
    from unnest(coalesce(p_modules, '{}')) m
   where m = any (array['bookings','rates','products','analytics','billing']);
  update public.portal_users set modules = v where user_id = p_user;
  if not found then raise exception 'Portal user not found'; end if;
  return jsonb_build_object('ok', true, 'modules', v);
end $$;
revoke all on function public.staff_set_portal_modules(uuid, text[]) from public, anon;
grant execute on function public.staff_set_portal_modules(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';

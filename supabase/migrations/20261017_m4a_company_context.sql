-- M4a Company context: current company per staff user, branch on ops records, branch refs.
--   current_company() / current_branch(): who is writing, and where.
--     staff  -> staff_companies.is_default company, home_branch
--     portal -> company of their customer account, first branch
--     other (sync, edge fns) -> NZ / AKL (they pass company_id explicitly)
--   company_id defaults to current_company() on every owned table (was 'NZ').
--   branch_id (default current_branch(), existing rows AKL) on ops tables. (branch, company) FK
--   stops a booking pointing at another company's branch.
--   Staff read scope follows the switcher: one company, or all their companies.
--   Refs: AKL keeps every current format (AKL-EA-0010, UBF-SI-26-0212, AKL-Q-00375).
--         Other branches: SUV-EA-0001, SUV-SI-26-0001, SUV-Q-00001 (own counters).
-- Idempotent. Safe to re-run.

begin;

-- 1. Context functions --------------------------------------------------------
create or replace function public.current_company() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select sc.company_id from staff_companies sc join staff_users su on su.user_id = sc.user_id
      where sc.user_id = auth.uid() and su.is_active and sc.is_default and sc.access = 'full' limit 1),
    (select sc.company_id from staff_companies sc join staff_users su on su.user_id = sc.user_id
      where sc.user_id = auth.uid() and su.is_active and sc.access = 'full'
      order by (sc.company_id = 'NZ') desc, sc.company_id limit 1),
    (select c.company_id from customers c where c.account_id = my_account_id()),
    'NZ');
$$;

create or replace function public.current_branch() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select sc.home_branch from staff_companies sc
      where sc.user_id = auth.uid() and sc.company_id = current_company() and sc.home_branch is not null),
    (select b.code from branches b where b.company_id = current_company()
      order by b.is_active desc, b.sort_order, b.code limit 1),
    'AKL');
$$;

-- Read scope: switcher company if set, else every company the user can see.
create or replace function public.my_scope() returns setof text
language sql stable security definer set search_path = public as $$
  with cur as (
    select sc.company_id from staff_companies sc
    where sc.user_id = auth.uid() and sc.is_default and sc.access = 'full')
  select m from my_companies() m
  where not exists (select 1 from cur) or m in (select company_id from cur);
$$;

-- Switcher. p_company null = all my companies.
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
    values (auth.uid(), p_company, 'full', false);   -- admin first visit
  end if;
  update staff_companies set is_default = false where user_id = auth.uid() and is_default;
  if p_company is not null then
    update staff_companies set is_default = true where user_id = auth.uid() and company_id = p_company;
  end if;
  return p_company;
end $$;

-- Header data for the switcher: companies the user can pick + current one.
create or replace function public.my_company_context() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'current', (select sc.company_id from staff_companies sc
                 where sc.user_id = auth.uid() and sc.is_default and sc.access = 'full' limit 1),
    'is_admin', is_admin(),
    'companies', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name,
                   'is_active', c.is_active, 'currency', c.base_currency) order by c.sort_order)
                 from companies c where c.code in (select my_companies())), '[]'::jsonb));
$$;

grant execute on function public.current_company(), public.current_branch(), public.my_scope(),
  public.set_my_company(text), public.my_company_context() to authenticated;

-- 2. Owned tables: default company = writer's company --------------------------
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join pg_class k on k.relname = c.table_name and k.relnamespace = 'public'::regnamespace and k.relkind = 'r'
    where c.table_schema = 'public' and c.column_name = 'company_id'
      and c.table_name not in ('branches','staff_companies','agent_company_codes')
  loop
    execute format('alter table public.%I alter column company_id set default public.current_company()', t);
  end loop;
end $$;

-- 3. Read scope follows switcher (owned tables; child tables follow parents) ----
do $$
declare t text;
begin
  for t in
    select tablename from pg_policies
    where schemaname = 'public' and policyname = 'zz_company_scope' and qual like '%my_companies%'
  loop
    execute format('alter policy zz_company_scope on public.%I
      using (not (select is_staff()) or company_id in (select my_scope()))
      with check (not (select is_staff()) or company_id in (select my_companies()))', t);
  end loop;
end $$;

-- 4. branch_id on ops tables -------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'branches_code_company_key') then
    alter table public.branches add constraint branches_code_company_key unique (code, company_id);
  end if;
end $$;

do $$
declare
  t text;
  ops text[] := array['bookings','quotes','booking_tasks','air_consols','courier_shipments',
    'customer_rate_cards','rate_requests','module_mailboxes','inbox_conversations','portal_threads',
    'tms_consignments','tms_trips','tms_depots','tms_vehicles','tms_drivers'];
begin
  foreach t in array ops loop
    continue when to_regclass('public.' || t) is null;
    -- constant default fills existing rows without an UPDATE (no triggers fire); all are NZ today
    execute format('alter table public.%I add column if not exists branch_id text not null default %L', t, 'AKL');
    execute format('alter table public.%I alter column branch_id set default public.current_branch()', t);
    if not exists (select 1 from pg_constraint where conname = t || '_branch_company_fkey') then
      execute format('alter table public.%I add constraint %I foreign key (branch_id, company_id)
                      references public.branches (code, company_id) not valid', t, t || '_branch_company_fkey');
      execute format('alter table public.%I validate constraint %I', t, t || '_branch_company_fkey');
    end if;
    execute format('create index if not exists %I on public.%I (branch_id)', t || '_branch_id_idx', t);
  end loop;
end $$;

-- 5. Per-branch reference counters (non-AKL) ----------------------------------
create table if not exists public.ref_counters (
  branch_id text not null references public.branches(code),
  kind      text not null,
  period    text not null default '',
  n         bigint not null default 0,
  primary key (branch_id, kind, period)
);
alter table public.ref_counters enable row level security;   -- no policies: functions only

create or replace function public.next_ref_no(p_branch text, p_kind text, p_period text default '')
returns bigint language sql volatile security definer set search_path = public as $$
  insert into ref_counters (branch_id, kind, period, n) values (p_branch, p_kind, coalesce(p_period, ''), 1)
  on conflict (branch_id, kind, period) do update set n = ref_counters.n + 1
  returning n;
$$;
revoke all on function public.next_ref_no(text, text, text) from public, anon, authenticated;

create or replace function public.set_booking_ref()
returns trigger language plpgsql security definer set search_path = public as $$
declare yy text; v_code text; pre text;
begin
  if new.booking_ref is null then
    yy := to_char(timezone('UTC', now()), 'YY');
    v_code := case new.module when 'ES' then 'SE' when 'IA' then 'AI' else 'SI' end;
    if coalesce(new.branch_id, 'AKL') = 'AKL' then
      if new.module = 'EA' then
        new.booking_ref := 'AKL-EA-' || lpad(nextval('public.ea_booking_ref_seq')::text, 4, '0');
      else
        new.booking_ref := 'UBF-' || v_code || '-' || yy || '-' || lpad(nextval('public.booking_ref_seq')::text, 4, '0');
      end if;
    else
      select b.ref_prefix into pre from branches b where b.code = new.branch_id;
      pre := coalesce(pre, new.branch_id);
      if new.module = 'EA' then
        new.booking_ref := pre || '-EA-' || lpad(next_ref_no(new.branch_id, 'EA')::text, 4, '0');
      else
        new.booking_ref := pre || '-' || v_code || '-' || yy || '-' || lpad(next_ref_no(new.branch_id, v_code, yy)::text, 4, '0');
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.gen_quote_no()
returns trigger language plpgsql security definer set search_path = public as $$
declare pre text;
begin
  if new.quote_no is null or new.quote_no = '' then
    if coalesce(new.branch_id, 'AKL') = 'AKL' then
      new.quote_no := 'AKL-Q-' || lpad(nextval('public.quote_no_seq')::text, 5, '0');
    else
      select b.ref_prefix into pre from branches b where b.code = new.branch_id;
      new.quote_no := coalesce(pre, new.branch_id) || '-Q-' || lpad(next_ref_no(new.branch_id, 'Q')::text, 5, '0');
    end if;
  end if;
  return new;
end $$;

commit;

notify pgrst, 'reload schema';

-- Verify:
-- select current_company(), current_branch(), my_company_context();
-- select count(*) from bookings where branch_id is null;   -- expect 0

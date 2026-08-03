-- Generalize rate_rules for multi-scope (global / vendor / customer) — EXPAND phase.
-- Keeps legacy shipping_line_code so the live Rules page keeps working; contract migration drops it later.

alter table public.rate_rules
  add column if not exists scope       text not null default 'global',
  add column if not exists vendor_kind text,
  add column if not exists vendor_code text,
  add column if not exists account_id  text references public.customers(account_id);

update public.rate_rules
   set scope = 'vendor',
       vendor_kind = coalesce(vendor_kind, 'shipping_line'),
       vendor_code = coalesce(vendor_code, shipping_line_code)
 where shipping_line_code is not null and scope <> 'vendor';

update public.rate_rules
   set scope = 'global'
 where shipping_line_code is null and scope is distinct from 'global';

alter table public.rate_rules drop constraint if exists rate_rules_scope_chk;
alter table public.rate_rules add  constraint rate_rules_scope_chk
  check (scope in ('global','vendor','customer'));

alter table public.rate_rules drop constraint if exists rate_rules_vendor_kind_chk;
alter table public.rate_rules add  constraint rate_rules_vendor_kind_chk
  check (vendor_kind is null or vendor_kind in ('shipping_line','airline','other'));

alter table public.rate_rules drop constraint if exists rate_rules_global_shape_chk;
alter table public.rate_rules add  constraint rate_rules_global_shape_chk
  check (scope <> 'global' or (vendor_kind is null and vendor_code is null and account_id is null));

alter table public.rate_rules drop constraint if exists rate_rules_vendor_shape_chk;
alter table public.rate_rules add  constraint rate_rules_vendor_shape_chk
  check (scope <> 'vendor' or (vendor_kind is not null and vendor_code is not null));

alter table public.rate_rules drop constraint if exists rate_rules_customer_shape_chk;
alter table public.rate_rules add  constraint rate_rules_customer_shape_chk
  check (scope <> 'customer' or account_id is not null);

create unique index if not exists rate_rules_one_global_uk
  on public.rate_rules (scope) where scope='global';
create unique index if not exists rate_rules_vendor_uk
  on public.rate_rules (vendor_kind, lower(vendor_code)) where scope='vendor';
create unique index if not exists rate_rules_customer_uk
  on public.rate_rules (account_id) where scope='customer';

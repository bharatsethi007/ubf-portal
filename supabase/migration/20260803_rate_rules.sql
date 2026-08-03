-- ============================================================
-- Rate Rules — house-rules markdown doc for the parse agent
-- ============================================================
create table if not exists public.rate_rules (
  id                 uuid primary key default gen_random_uuid(),
  shipping_line_code text references public.shipping_lines(code),  -- null = global house rules
  title              text not null default 'Rate Card House Rules',
  content            text not null default '',                      -- markdown the parse agent reads
  updated_by         uuid references public.staff_users(user_id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Exactly one global (carrier-less) rules doc
create unique index if not exists rate_rules_global_uk
  on public.rate_rules ((shipping_line_code is null)) where shipping_line_code is null;
-- One doc per carrier when scoped later
create unique index if not exists rate_rules_carrier_uk
  on public.rate_rules (shipping_line_code) where shipping_line_code is not null;

-- Seed the single global doc
insert into public.rate_rules (shipping_line_code, title, content)
select null, 'Rate Card House Rules', ''
where not exists (select 1 from public.rate_rules where shipping_line_code is null);

-- RLS: staff-only, consistent with the rest of the module
alter table public.rate_rules enable row level security;
create policy staff_all_rate_rules on public.rate_rules
  for all using (is_staff()) with check (is_staff());

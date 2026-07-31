-- 20260731_charge_templates.sql  (already applied to production)
create table if not exists public.charge_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.charge_template_lines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.charge_templates(id) on delete cascade,
  ord integer not null default 0,
  description text,
  is_service_charge boolean not null default false,
  charge_group text,
  vendor text,
  unit text,
  qty numeric,
  buy_currency text,
  sell_currency text,
  min_buy numeric,
  min_sell numeric,
  buy_rate numeric,
  sell_rate numeric,
  tax text
);
create index if not exists charge_template_lines_tpl_idx on public.charge_template_lines (template_id, ord);
alter table public.charge_templates enable row level security;
alter table public.charge_template_lines enable row level security;
create policy charge_templates_staff_all on public.charge_templates for all using (is_staff()) with check (is_staff());
create policy charge_template_lines_staff_all on public.charge_template_lines for all using (is_staff()) with check (is_staff());

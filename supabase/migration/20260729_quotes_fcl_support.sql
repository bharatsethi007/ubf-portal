-- 1. Port columns on quotes (sea FCL origin/destination)
alter table public.quotes
  add column if not exists from_port_code text references public.ports(code),
  add column if not exists to_port_code   text references public.ports(code);

-- 2. Container groups for FCL quotes (mirrors the container-group UI)
create table if not exists public.quote_containers (
  id                       uuid primary key default gen_random_uuid(),
  quote_id                 uuid not null references public.quotes(id) on delete cascade,
  ord                      integer not null default 0,
  container_size           text not null check (container_size in ('20','40','40HC','45HC')),
  container_type           text not null default 'standard'
                             check (container_type in ('standard','reefer','opentop','flatrack','isotank','openside')),
  qty                      integer not null default 1 check (qty > 0),
  weight_per_container_mt  numeric,
  commodity                text,
  created_at               timestamptz not null default now()
);

create index if not exists quote_containers_quote_id_idx
  on public.quote_containers(quote_id);

-- 3. RLS: staff-only, mirroring quote_cargo_lines
alter table public.quote_containers enable row level security;

create policy quote_containers_staff_all
  on public.quote_containers
  for all
  using (public.is_staff())
  with check (public.is_staff());

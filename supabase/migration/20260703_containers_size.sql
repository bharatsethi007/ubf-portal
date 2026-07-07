-- Container ISO size from TradeWindow FRT_CONTAINER.C_TYPE (synced by sync_to_supabase.py).
-- Values: 20 | 40 | 40HC

alter table public.containers
  add column if not exists container_size text;

alter table public.containers
  drop constraint if exists containers_container_size_check;

alter table public.containers
  add constraint containers_container_size_check
  check (container_size is null or container_size in ('20', '40', '40HC'));

comment on column public.containers.container_size is
  'Normalized size from FRT_CONTAINER.C_TYPE (20GP/22G1→20, 40GP/42G1→40, 40HC/45G1→40HC).';

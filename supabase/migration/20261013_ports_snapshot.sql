-- Ports snapshot: whole ports list in ONE request instead of ~27 pages per hook, cached in the browser.
--   * ports_meta.version bumps on any insert/update/delete on ports (statement trigger).
--   * ports_snapshot(p_have): returns {version, rows} where rows = [[code,name,country,lat,lng,kind,is_core],...].
--     If p_have = current version, rows is null (browser cache is fresh, nothing downloaded).
-- Idempotent.

create table if not exists public.ports_meta (
  id boolean primary key default true check (id),
  version bigint not null default 1
);
insert into public.ports_meta (id, version) values (true, 1) on conflict (id) do nothing;
alter table public.ports_meta enable row level security;
drop policy if exists ports_meta_read on public.ports_meta;
create policy ports_meta_read on public.ports_meta for select to authenticated using (true);

create or replace function public.ports_bump_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.ports_meta set version = version + 1 where id;
  return null;
end $$;

drop trigger if exists trg_ports_bump_version on public.ports;
create trigger trg_ports_bump_version after insert or update or delete or truncate on public.ports
  for each statement execute function public.ports_bump_version();

create or replace function public.ports_snapshot(p_have bigint default null)
returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'version', m.version,
    'rows', case when p_have is not distinct from m.version then null else (
      select coalesce(jsonb_agg(jsonb_build_array(
               p.code, p.name, p.country_code,
               round(p.lat::numeric, 4), round(p.lng::numeric, 4), p.kind, p.is_core)
             order by p.is_core desc, p.name, p.code), '[]'::jsonb)
        from public.ports p) end)
  from public.ports_meta m
$$;
revoke all on function public.ports_snapshot(bigint) from public, anon;
grant execute on function public.ports_snapshot(bigint) to authenticated;

notify pgrst, 'reload schema';

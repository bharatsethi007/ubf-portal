-- APPLIED 12 Oct 2026 via MCP (migration ports_load_unlocode_ourairports). DO NOT RE-RUN.
-- Source files were fetched into net._http_response with pg_net:
--   UN/LOCODE  https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv  (md5 480111c3...)
--   OurAirports https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv (md5 22e8191a...)
-- Result: +17,300 seaports (UN function 1, not deleted/rejected), +71 airports,
--         ~1,420 airport rows fixed (stale IATA reassignment or missing coords).
-- Existing 267 sea ports flagged is_core = true (pickers list them first; rate-card parse prompts use only these).

alter table public.ports add column if not exists is_core boolean not null default false;
alter table public.ports add column if not exists source text;
update public.ports set is_core = true where kind = 'sea' and is_core = false;

create or replace function pg_temp.csvf(line text) returns text[] language sql immutable as $$
  select array_agg(case when m[1] like '"%' then replace(substr(m[1],2,length(m[1])-2),'""','"') else m[1] end order by o)
  from regexp_matches(line, '("(?:[^"]|"")*"|[^,]*)(,|$)', 'g') with ordinality r(m,o) $$;
create or replace function pg_temp.dm(s text) returns double precision language sql immutable as $$
  select case when s ~ '^\d{4,5}[NSEW]$' then
    (case when right(s,1) in ('S','W') then -1 else 1 end) *
    (left(s,length(s)-3)::int + substr(s,length(s)-2,2)::int/60.0) end $$;

insert into public.ports (code, name, lat, lng, kind, country_code, is_core, source)
select distinct on (code) code, name, pg_temp.dm(split_part(coord,' ',1)), pg_temp.dm(split_part(coord,' ',2)), 'sea', cc, false, 'unlocode'
from (
  select f[2]||f[3] code, f[5] name, f[2] cc, f[7] status, f[8] fn, f[1] chg, f[11] coord
  from net._http_response r, regexp_split_to_table(r.content, E'\r?\n') with ordinality t(l,n),
       lateral (select pg_temp.csvf(l) f) x
  where r.id = 18598 and n > 1 and l <> ''
) s
where left(fn,1) = '1' and coalesce(chg,'') <> 'X' and status not in ('XX','RR')
  and exists (select 1 from public.countries c where c.code = s.cc)
order by code, (coord = '')
on conflict (code) do nothing;

create temp table oa on commit drop as
select distinct on (iata) iata, name, lat, lng, cc from (
  select f[14] iata, f[4] name, nullif(f[5],'')::double precision lat, nullif(f[6],'')::double precision lng, f[9] cc, f[3] typ, f[12] sched
  from net._http_response r, regexp_split_to_table(r.content, E'\r?\n') with ordinality t(l,n),
       lateral (select pg_temp.csvf(l) f) x
  where r.id = 18599 and n > 1 and l <> ''
) a
where iata ~ '^[A-Z]{3}$' and typ in ('large_airport','medium_airport','small_airport','seaplane_base')
  and exists (select 1 from public.countries c where c.code = a.cc)
order by iata, (sched <> 'yes'), array_position(array['large_airport','medium_airport','small_airport','seaplane_base'], typ);

update public.ports p set name = oa.name, lat = oa.lat, lng = oa.lng, country_code = oa.cc, source = 'ourairports'
from oa where p.code = oa.iata and p.kind = 'air'
  and (p.country_code is distinct from oa.cc or p.lat is null);

insert into public.ports (code, name, lat, lng, kind, country_code, is_core, source)
select iata, name, lat, lng, 'air', cc, false, 'ourairports' from oa
on conflict (code) do nothing;

create index if not exists ports_kind_name_idx on public.ports (kind, name);
comment on column public.ports.is_core is 'Curated port shown first in pickers and sent to rate-card parse prompts.';
notify pgrst, 'reload schema';

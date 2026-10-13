-- Export Air step 3: consol details entered in the portal (no TW import needed). Idempotent.
alter table public.air_consols add column if not exists transit_port text;
alter table public.air_consols add column if not exists flight2_no text;
alter table public.air_consols add column if not exists flight2_date date;
alter table public.air_consols add column if not exists eta_date date;

-- c.* is frozen at view creation, so rebuild to pick up the new columns
drop view if exists public.v_air_consols;
create view public.v_air_consols with (security_invoker = true) as
select c.*,
  coalesce(t.houses, 0) as houses,
  coalesce(t.pieces, 0) as pieces,
  coalesce(t.kg, 0) as kg,
  coalesce(t.chg_kg, 0) as chg_kg
from public.air_consols c
left join lateral (
  select count(*)::int as houses, sum(coalesce(a.pcs, b.pieces)) as pieces,
         sum(coalesce(a.kg, b.weight_kg)) as kg,
         sum(coalesce(b.chargeable_weight_kg, greatest(coalesce(a.kg, b.weight_kg, 0), coalesce(a.cbm, b.volume_m3, 0) * 167))) as chg_kg
  from public.bookings b
  left join lateral (select sum(l.pieces) as pcs, sum(l.weight) as kg, sum(l.cbm) as cbm
                     from public.booking_cargo_lines l where l.booking_id = b.id and l.kind = 'actual') a on true
  where b.consol_id = c.id and b.archived_at is null
) t on true;

notify pgrst, 'reload schema';

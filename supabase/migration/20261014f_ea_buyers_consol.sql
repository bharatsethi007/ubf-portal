-- 20261014f_ea_buyers_consol.sql
-- Buyers consolidation for Export Air.
-- A master HAWB (bookings.is_consolidation = true, shipper "Various Shippers") groups sub-HAWBs
-- (bookings.master_booking_id = master.id). Each sub keeps its own pickup, check-in, SLI, docs and emails.
-- Only the master goes to TradeWindow as a house; its figures are the sum of its subs.

-- 1. Link
alter table public.bookings
  add column if not exists master_booking_id uuid references public.bookings(id) on delete set null;
create index if not exists bookings_master_booking_idx on public.bookings (master_booking_id) where master_booking_id is not null;
alter table public.bookings drop constraint if exists bookings_master_not_self;
alter table public.bookings add constraint bookings_master_not_self check (master_booking_id is distinct from id);

-- 2. Subs ride on the master's consol (the export lock trigger still guards each row)
create or replace function public.ea_master_follow()
returns trigger language plpgsql as $$
begin
  if coalesce(new.is_consolidation, false) and new.consol_id is distinct from old.consol_id then
    update public.bookings set consol_id = new.consol_id
     where master_booking_id = new.id and consol_id is distinct from new.consol_id;
  end if;
  return null;
end $$;
drop trigger if exists trg_ea_master_follow on public.bookings;
create trigger trg_ea_master_follow after update of consol_id on public.bookings
  for each row execute function public.ea_master_follow();

-- 3. Consolidate: new master (p_master null) or add to an existing one. Returns the master id.
create or replace function public.ea_consolidate(p_children uuid[], p_master uuid default null)
returns uuid language plpgsql security invoker as $$
declare
  m public.bookings;
  first_child public.bookings;
  n_keys int;
begin
  if coalesce(array_length(p_children, 1), 0) = 0 and p_master is null then
    raise exception 'Pick at least one HAWB';
  end if;

  if exists (select 1 from public.bookings where id = any(p_children) and coalesce(is_consolidation, false)) then
    raise exception 'A master HAWB cannot be a sub-HAWB';
  end if;
  if exists (select 1 from public.bookings where id = any(p_children) and master_booking_id is not null
             and master_booking_id is distinct from p_master) then
    raise exception 'One of these HAWBs is already in another consolidation';
  end if;

  if p_master is not null then
    select * into m from public.bookings where id = p_master and coalesce(is_consolidation, false);
    if not found then raise exception 'Master HAWB not found'; end if;
  end if;

  -- Same buyer: consignee code, or name when no code yet.
  select count(distinct coalesce(consignee_account_id, lower(trim(consignee_name)), '?')) into n_keys
    from public.bookings
   where id = any(p_children) or id = p_master;
  if n_keys > 1 then
    raise exception 'All HAWBs in a buyers consol must go to the same consignee';
  end if;

  select * into first_child from public.bookings where id = any(p_children) order by created_at limit 1;

  if p_master is null then
    insert into public.bookings (
      module, source, status, account_id, origin, destination, incoterm, is_consolidation,
      shipper_account_id, shipper_name, consignee_account_id, consignee_name, consignee_address, consignee_city,
      consignee_country, consignee_phone, consignee_contact, consignee_email, bill_to_account_id, consol_id,
      collection_mode, handled_by, created_by, customer_ref
    ) values (
      'EA', 'manual', 'confirmed', first_child.account_id, 'AKL', first_child.destination, first_child.incoterm, true,
      'VARIFJ', 'Various Shippers', first_child.consignee_account_id, first_child.consignee_name, first_child.consignee_address,
      first_child.consignee_city, first_child.consignee_country, first_child.consignee_phone, first_child.consignee_contact,
      first_child.consignee_email, first_child.bill_to_account_id, first_child.consol_id,
      'dropoff', first_child.handled_by, auth.uid(), null
    ) returning * into m;
  elsif m.consol_id is null and first_child.consol_id is not null then
    update public.bookings set consol_id = first_child.consol_id where id = m.id returning * into m;
  end if;

  update public.bookings
     set master_booking_id = m.id,
         consol_id = coalesce(m.consol_id, consol_id)
   where id = any(p_children);

  return m.id;
end $$;

-- 4. Take a sub-HAWB out (it becomes a normal HAWB on the same consol).
create or replace function public.ea_unconsolidate(p_child uuid)
returns void language sql security invoker as $$
  update public.bookings set master_booking_id = null where id = p_child;
$$;

-- 5. Dissolve: subs go back to normal HAWBs, the master is archived.
create or replace function public.ea_dissolve(p_master uuid)
returns void language plpgsql security invoker as $$
begin
  update public.bookings set master_booking_id = null where master_booking_id = p_master;
  update public.bookings set archived_at = now() where id = p_master and coalesce(is_consolidation, false);
end $$;

grant execute on function public.ea_consolidate(uuid[], uuid) to authenticated;
grant execute on function public.ea_unconsolidate(uuid) to authenticated;
grant execute on function public.ea_dissolve(uuid) to authenticated;

-- 6. v_ea_bookings gains master_booking_id (appended, so existing columns keep their places).
do $$
declare d text;
begin
  d := pg_get_viewdef('public.v_ea_bookings'::regclass);
  if position('master_booking_id' in d) > 0 then return; end if;
  d := replace(d, 'b.bc_sent_at,', 'b.bc_sent_at, b.master_booking_id,');
  d := replace(d, 'base.bc_sent_at,', 'base.bc_sent_at, base.master_booking_id,');
  d := replace(d, ' s.bc_sent_at,', ' s.bc_sent_at, s.master_booking_id,');
  d := replace(d, E'END) AS priority\n   FROM acted a;', E'END) AS priority,\n    master_booking_id\n   FROM acted a');
  execute 'create or replace view public.v_ea_bookings as ' || d;
end $$;

-- 7. Consol totals: a master and its subs count as one house; cargo comes from the subs, not the master.
create or replace view public.v_air_consols as
select c.id, c.origin, c.destination, c.airline, c.flight_no, c.flight_date, c.cutoff_at, c.mawb, c.status,
       c.handled_by, c.exported_at, c.erp_consol_key, c.notes, c.created_by, c.created_at, c.updated_at,
       c.transit_port, c.flight2_no, c.flight2_date, c.eta_date,
       coalesce(t.houses, 0) as houses,
       coalesce(t.pieces, 0::numeric) as pieces,
       coalesce(t.kg, 0::numeric) as kg,
       coalesce(t.chg_kg, 0::numeric) as chg_kg
  from public.air_consols c
  left join lateral (
    select (count(*) filter (where b.master_booking_id is null))::integer as houses,
           sum(coalesce(a.pcs::numeric, b.pieces)) filter (where not coalesce(b.is_consolidation, false)) as pieces,
           sum(coalesce(a.kg, b.weight_kg)) filter (where not coalesce(b.is_consolidation, false)) as kg,
           sum(coalesce(b.chargeable_weight_kg, greatest(coalesce(a.kg, b.weight_kg, 0::numeric),
               coalesce(a.cbm, b.volume_m3, 0::numeric) * 167::numeric)))
             filter (where not coalesce(b.is_consolidation, false)) as chg_kg
      from public.bookings b
      left join lateral (
        select sum(l.pieces) as pcs, sum(l.weight) as kg, sum(l.cbm) as cbm
          from public.booking_cargo_lines l
         where l.booking_id = b.id and l.kind = 'actual'
      ) a on true
     where b.consol_id = c.id and b.archived_at is null
  ) t on true;

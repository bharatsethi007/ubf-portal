-- Export Air bookings workspace (Step 1). Idempotent. Run once in Supabase SQL Editor.
-- Adds: AKL-EA-#### refs, air_consols, booking consol/party links, booking_threads,
-- booked vs actual cargo lines, export lock, v_ea_bookings + v_air_consols.

-- 1. Ref format AKL-EA-0001 for new EA bookings (old refs untouched)
create sequence if not exists public.ea_booking_ref_seq;

create or replace function public.set_booking_ref()
returns trigger language plpgsql as $$
declare yy text; code text;
begin
  if new.booking_ref is null then
    if new.module = 'EA' then
      new.booking_ref := 'AKL-EA-' || lpad(nextval('public.ea_booking_ref_seq')::text, 4, '0');
      return new;
    end if;
    yy := to_char(timezone('UTC', now()), 'YY');
    code := case new.module when 'ES' then 'SE' when 'IA' then 'AI' else 'SI' end;
    new.booking_ref := 'UBF-' || code || '-' || yy || '-' || lpad(nextval('booking_ref_seq')::text, 4, '0');
  end if;
  return new;
end $$;

-- 2. Air consols (planned before airline confirms; locked after export)
create table if not exists public.air_consols (
  id uuid primary key default gen_random_uuid(),
  origin text not null default 'AKL',
  destination text not null default 'NAN',
  airline text,
  flight_no text not null,
  flight_date date not null,
  cutoff_at timestamptz,
  mawb text,
  status text not null default 'planned'
    check (status in ('planned','confirmed','closed','exported','departed','cancelled')),
  handled_by uuid references public.staff_users(user_id),
  exported_at timestamptz,
  erp_consol_key text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists air_consols_lane_date on public.air_consols (origin, destination, flight_date);
create unique index if not exists air_consols_mawb_uq on public.air_consols (mawb) where mawb is not null;

alter table public.air_consols enable row level security;
drop policy if exists air_consols_staff_all on public.air_consols;
create policy air_consols_staff_all on public.air_consols for all using (public.is_staff()) with check (public.is_staff());

drop trigger if exists trg_air_consols_touch on public.air_consols;
create trigger trg_air_consols_touch before update on public.air_consols
  for each row execute function public.touch_updated_at();

-- 3. Booking links: TW party codes, consol, collection mode
alter table public.bookings add column if not exists shipper_account_id text references public.customers(account_id);
alter table public.bookings add column if not exists bill_to_account_id text references public.customers(account_id);
alter table public.bookings add column if not exists consol_id uuid references public.air_consols(id) on delete set null;
alter table public.bookings add column if not exists collection_mode text;
alter table public.bookings drop constraint if exists bookings_collection_mode_check;
alter table public.bookings add constraint bookings_collection_mode_check
  check (collection_mode is null or collection_mode in ('pickup','dropoff'));
create index if not exists bookings_consol_id_idx on public.bookings (consol_id) where consol_id is not null;

-- Lock: no allocation change once the consol has gone to TradeWindow
create or replace function public.bookings_consol_lock()
returns trigger language plpgsql as $$
begin
  if new.consol_id is distinct from old.consol_id then
    if exists (select 1 from public.air_consols c
               where c.id in (old.consol_id, new.consol_id) and c.status in ('exported','departed')) then
      raise exception 'Consol already exported to TradeWindow. Allocation is locked.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_bookings_consol_lock on public.bookings;
create trigger trg_bookings_consol_lock before update of consol_id on public.bookings
  for each row execute function public.bookings_consol_lock();

-- 4. Many emails threads per booking, many bookings per thread
create table if not exists public.booking_threads (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  linked_by uuid default auth.uid(),
  linked_at timestamptz not null default now(),
  primary key (booking_id, conversation_id)
);
alter table public.booking_threads enable row level security;
drop policy if exists booking_threads_staff_all on public.booking_threads;
create policy booking_threads_staff_all on public.booking_threads for all using (public.is_staff()) with check (public.is_staff());

insert into public.booking_threads (booking_id, conversation_id)
select booking_id, id from public.inbox_conversations where booking_id is not null
on conflict do nothing;

-- 5. Booked vs checked-in cargo (no deletes: actuals sit beside booked lines)
alter table public.booking_cargo_lines add column if not exists kind text not null default 'booked';
alter table public.booking_cargo_lines drop constraint if exists booking_cargo_lines_kind_check;
alter table public.booking_cargo_lines add constraint booking_cargo_lines_kind_check check (kind in ('booked','actual'));
alter table public.booking_cargo_lines add column if not exists checked_in_at timestamptz;

-- 6. Consol view with totals from allocated houses
drop view if exists public.v_air_consols;
create view public.v_air_consols with (security_invoker = true) as
select c.*,
  coalesce(t.houses, 0) as houses,
  coalesce(t.pieces, 0) as pieces,
  coalesce(t.kg, 0) as kg,
  coalesce(t.chg_kg, 0) as chg_kg
from public.air_consols c
left join lateral (
  select count(*)::int as houses, sum(b.pieces) as pieces, sum(b.weight_kg) as kg,
         sum(coalesce(b.chargeable_weight_kg, b.weight_kg)) as chg_kg
  from public.bookings b where b.consol_id = c.id and b.archived_at is null
) t on true;

-- 7. EA board view: one row per open EA booking, deterministic stage + next action
drop view if exists public.v_ea_bookings;
create view public.v_ea_bookings with (security_invoker = true) as
with base as (
  select b.*,
    sh.name as shipper_code_name, cn.name as consignee_code_name, bt.name as bill_to_name,
    su.initials as owner_initials, su.full_name as owner_name,
    q.quote_no,
    c.flight_no as consol_flight, c.flight_date as consol_date, c.status as consol_status, c.mawb as consol_mawb,
    tms.consignment_no as tms_no, tms.preferred_pickup_at, tms.picked_up_at, tms.wms_checkin_at,
    act.pcs as act_pcs, act.kg as act_kg, act.cbm as act_cbm, act.at as act_at,
    sli.status as sli_status, sli.signed_at as sli_signed_at,
    coalesce(th.n, 0) as thread_count
  from public.bookings b
  left join public.customers sh on sh.account_id = b.shipper_account_id
  left join public.customers cn on cn.account_id = b.consignee_account_id
  left join public.customers bt on bt.account_id = b.bill_to_account_id
  left join public.staff_users su on su.user_id = b.handled_by
  left join public.quotes q on q.id = b.quote_id
  left join public.air_consols c on c.id = b.consol_id
  left join lateral (select t.* from public.tms_consignments t where t.booking_id = b.id
                     order by t.created_at desc limit 1) tms on true
  left join lateral (select sum(l.pieces) as pcs, sum(l.weight) as kg, sum(l.cbm) as cbm, max(l.checked_in_at) as at
                     from public.booking_cargo_lines l where l.booking_id = b.id and l.kind = 'actual') act on true
  left join lateral (select s.status, s.signed_at from public.sli_documents s where s.booking_id = b.id
                     order by s.created_at desc limit 1) sli on true
  left join lateral (select count(*)::int as n from public.booking_threads bt2 where bt2.booking_id = b.id) th on true
  where b.module = 'EA' and b.archived_at is null and b.status <> 'rejected'
), staged as (
  select base.*,
    (act_pcs is not null or wms_checkin_at is not null) as checked_in,
    case
      when status in ('draft','new','submitted','parsed') then -1
      when consol_status in ('departed') then 6
      when consol_status in ('exported') then 5
      when consol_id is not null then 4
      when sli_signed_at is not null and (act_pcs is not null or wms_checkin_at is not null) then 3
      when act_pcs is not null or wms_checkin_at is not null then 2
      when tms_no is not null then 1
      else 0
    end as stage
  from base
), acted as (
  select s.*,
    case
      when stage = -1 and source in ('email_import','email_parsed') then 'Review email draft'
      when stage = -1 and source = 'customer_portal' then 'Review portal request'
      when stage = -1 then 'Submit draft'
      when hold_code is not null then 'Resolve hold'
      when shipper_account_id is null or consignee_account_id is null then 'Match TradeWindow accounts'
      when stage = 0 and coalesce(collection_mode, 'pickup') = 'pickup' then 'Book pickup'
      when stage = 0 then 'Await supplier drop-off'
      when stage = 1 then 'Pickup ' || coalesce(to_char(preferred_pickup_at at time zone 'Pacific/Auckland', 'Dy DD HH24:MI'), 'booked')
      when stage = 2 then 'Allocate to consol'
      when stage = 3 then 'Allocate to consol'
      when stage = 4 then 'Ready for close'
      when stage = 5 then 'Awaiting departure'
      else 'Departed'
    end as next_action,
    case
      when stage = -1 and source = 'customer_portal' then created_at + interval '4 hours'
      when stage = -1 and source in ('email_import','email_parsed') then created_at + interval '4 hours'
      when stage = -1 then created_at + interval '1 day'
      when hold_code is not null then now()
      when shipper_account_id is null or consignee_account_id is null then created_at + interval '1 day'
      when stage = 0 then coalesce(cargo_ready_date::timestamptz - interval '1 day', created_at + interval '1 day')
      when stage = 1 then coalesce(preferred_pickup_at, cargo_ready_date::timestamptz)
      when stage in (2,3) then coalesce(act_at, wms_checkin_at, now()) + interval '2 days'
      else null
    end as action_due
  from staged s
)
select a.*,
  case
    when a.hold_code is not null then 'blocked'
    when a.action_due is null then 'ok'
    when a.action_due < now() then 'overdue'
    when (a.action_due at time zone 'Pacific/Auckland')::date = (now() at time zone 'Pacific/Auckland')::date then 'today'
    when a.action_due < now() + interval '2 days' then 'soon'
    else 'ok'
  end as urgency,
  case
    when a.hold_code is not null then 900
    when a.action_due is null then 0
    when a.action_due < now() then 1000 + least(500, extract(epoch from now() - a.action_due) / 3600)::int
    when a.action_due < now() + interval '1 day' then 500
    when a.action_due < now() + interval '2 days' then 200
    else 50
  end + case when a.handled_by is null and a.stage < 4 then 50 else 0 end as priority
from acted a;

notify pgrst, 'reload schema';

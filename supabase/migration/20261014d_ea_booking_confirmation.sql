-- Export Air booking confirmation: send from the export air mailbox, remember when the BC went out. Idempotent.
insert into public.module_mailboxes (module, mailbox, display_name, updated_at)
values ('EA', 'exportair.nz@ubfreight.com', 'UB Freight Export Air', now())
on conflict (module) do update set mailbox = excluded.mailbox, display_name = excluded.display_name, updated_at = now();

alter table public.bookings add column if not exists bc_sent_at timestamptz;

-- v_ea_bookings selects b.*, which is frozen at creation: rebuild it so bc_sent_at shows.
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

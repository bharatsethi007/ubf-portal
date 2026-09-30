-- Bookings unification P0 + P1 (rev 3: date dues end of NZ day; rev 2: ERP-linked never request, Link ERP job, pre-arrival cartage, Confirm arrival). Applied live via MCP 2026-09-30. Repo parity copy, do not re-run.
-- P0: bookings.mode is derived from bookings.module (module is the source of truth).
-- P1: v_booking_flow = deterministic lifecycle stage + next action + urgency per booking.

-- ---------- P0: mode follows module ----------
alter table public.bookings alter column mode drop default;

create or replace function public.bookings_sync_mode()
returns trigger language plpgsql as $$
begin
  new.mode := case new.module
    when 'IS' then 'sea_import'
    when 'ES' then 'sea_export'
    when 'IA' then 'air_import'
    when 'EA' then 'air_export'
  end;
  return new;
end $$;

-- name sorts after bookings_redirect_load_type so FCL/LCL redirect runs first
drop trigger if exists trg_bookings_zsync_mode on public.bookings;
create trigger trg_bookings_zsync_mode
  before insert or update on public.bookings
  for each row execute function public.bookings_sync_mode();

update public.bookings set mode = mode
where mode is distinct from case module
  when 'IS' then 'sea_import' when 'ES' then 'sea_export'
  when 'IA' then 'air_import' when 'EA' then 'air_export' end;

-- ---------- P1: flow engine ----------
drop view if exists public.v_booking_flow;
create view public.v_booking_flow with (security_invoker = true) as
with f as (
  select
    b.id as booking_id, b.module, b.source, b.status, b.load_type, b.job_no,
    b.archived_at, b.created_at, b.handled_by, b.quote_id, b.shipment_id,
    b.hold_code, hr.label as hold_label,
    b.swb_released, b.tlx_release_on_hand, b.cleared, b.truck_booked,
    b.inv_approved, b.inv_sent, b.container_return_date,
    (b.module in ('IS','IA')) as is_import,
    (now() at time zone 'Pacific/Auckland')::date as today,
    coalesce(pc.eta, s.eta, b.m_eta, b.eta::date) as eta,
    coalesce(s.etd, b.etd::date) as etd,
    s.departed,
    coalesce(pc.ata, s.arrived, b.discharge_date) as arrived,
    coalesce(pc.last_free_day, b.last_free_day) as last_free_day,
    coalesce(pc.delivery_date, b.delivery_date, tms.delivered_at::date) as delivered,
    coalesce(pc.port_cleared, false) as port_cleared,
    coalesce(pc.line_released, false) as line_released,
    (select count(*) from public.booking_containers bc where bc.booking_id = b.id) as container_count,
    tms.id as tms_id, tms.consignment_no as tms_no, tms.status as tms_status,
    q.quote_no,
    s.consol_key as erp_job,
    (select count(*) from public.booking_tasks t
      where t.booking_id = b.id and t.status is distinct from 'done' and t.completed_at is null) as open_tasks
  from public.bookings b
  left join public.shipments s on s.job_unique = b.shipment_id
  left join public.hold_reasons hr on hr.code = b.hold_code
  left join public.quotes q on q.id = b.quote_id
  left join lateral (
    select c.id, c.consignment_no, c.status, c.delivered_at
    from public.tms_consignments c
    where c.booking_id = b.id and c.status <> 'archived'
    order by c.delivered_at desc nulls first
    limit 1
  ) tms on true
  left join lateral (
    select (min(ct.inbound_eta))::date as eta,
           (min(ct.inbound_ata))::date as ata,
           (min(ct.last_free_at))::date as last_free_day,
           (min(ct.delivered_at))::date as delivery_date,
           bool_and(ct.customs_release_at is not null and ct.mpi_release_at is not null) as port_cleared,
           bool_and(ct.line_release_at is not null) as line_released
    from public.container_tracking ct where ct.booking_id = b.id
  ) pc on true
),
s as (
  select f.*,
    case
      when f.status = 'rejected' then 'declined'
      when f.archived_at is not null then 'closed'
      when f.shipment_id is null and (f.status in ('draft','submitted','parsed')
        or (f.status = 'new' and f.source <> 'manual')) then 'request'
      when f.inv_sent then 'closed'
      when f.is_import and f.delivered is not null then 'invoicing'
      when not f.is_import and f.departed is not null and f.arrived is not null then 'invoicing'
      when f.is_import and f.arrived is not null then 'arrived'
      when f.departed is not null or f.etd <= f.today then 'in_transit'
      else 'booked'
    end as stage,
    (f.module = 'IS' and f.container_count > 0 and f.load_type is distinct from 'LCL') as needs_empty_return,
    (f.truck_booked or f.tms_id is not null) as cartage_booked
  from f
),
a as (
  select s.*,
    case
      when s.stage in ('declined','closed') then null
      when s.stage = 'request' and s.source = 'customer_portal' then 'Review portal request'
      when s.stage = 'request' and s.source like 'email%' then 'Complete email draft'
      when s.stage = 'request' then 'Submit draft'
      when s.hold_code is not null then 'Resolve hold: ' || coalesce(s.hold_label, s.hold_code)
      when s.shipment_id is null and nullif(trim(s.job_no), '') is not null then 'Link ERP job'
      when s.shipment_id is null then 'Key into CyberFreight'
      when s.module = 'IS' and s.stage in ('in_transit','booked','arrived')
        and not (s.swb_released or s.tlx_release_on_hand) and s.eta <= s.today + 5 then 'Get SWB / telex release'
      when s.module = 'IS' and s.stage in ('in_transit','booked','arrived')
        and not s.port_cleared and s.eta <= s.today + 3 then 'Chase customs / MPI clearance'
      when s.module = 'IS' and s.stage in ('in_transit','booked','arrived')
        and not s.line_released and s.eta <= s.today + 3 then 'Chase line release'
      when s.is_import and s.stage in ('in_transit','booked') and not s.cartage_booked
        and s.eta <= s.today + 2 then 'Book cartage'
      when s.is_import and s.stage = 'in_transit' and s.eta < s.today then 'Confirm arrival'
      when s.is_import and s.stage = 'arrived' and not s.cartage_booked then 'Book cartage'
      when s.is_import and s.stage = 'arrived' then 'Deliver'
      when not s.is_import and s.stage = 'booked' and not s.cartage_booked
        and s.etd <= s.today + 3 then 'Book pickup'
      when s.stage = 'invoicing' and s.needs_empty_return and s.container_return_date is null then 'Return empty'
      when s.stage = 'invoicing' and not s.inv_approved then 'Approve invoice'
      when s.stage = 'invoicing' then 'Send invoice'
      else null
    end as next_action
  from s
),
d as (
  select a.*,
    case
      when a.next_action is null then null
      when a.next_action = 'Review portal request' then a.created_at + interval '4 hours'
      when a.next_action = 'Complete email draft' then a.created_at + interval '1 day'
      when a.next_action = 'Submit draft' then a.created_at + interval '2 days'
      when a.next_action like 'Resolve hold%' then now()
      when a.next_action in ('Key into CyberFreight','Link ERP job') then a.created_at + interval '1 day'
      when a.next_action = 'Confirm arrival' then ((a.eta + 2)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action = 'Get SWB / telex release' then ((a.eta - 1)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action in ('Chase customs / MPI clearance','Chase line release') then ((a.eta + 1)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action = 'Book cartage' then ((coalesce(a.last_free_day - 1, a.arrived + 1, a.eta) + 1)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action = 'Deliver' then ((coalesce(a.last_free_day, a.arrived + 3) + 1)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action = 'Book pickup' then ((a.etd - 1)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action = 'Return empty' then ((a.delivered + 4)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action = 'Approve invoice' then ((coalesce(a.delivered, a.arrived, a.departed) + 3)::timestamp at time zone 'Pacific/Auckland')
      when a.next_action = 'Send invoice' then ((coalesce(a.delivered, a.arrived, a.departed) + 4)::timestamp at time zone 'Pacific/Auckland')
    end as action_due
  from a
)
select
  d.booking_id, d.module, d.stage,
  array_position(array['request','booked','in_transit','arrived','invoicing','closed','declined'], d.stage) as stage_order,
  d.next_action, d.action_due,
  case
    when d.next_action is null then 'none'
    when d.hold_code is not null then 'blocked'
    when d.action_due < now() then 'overdue'
    when ((d.action_due - interval '1 second') at time zone 'Pacific/Auckland')::date <= d.today then 'today'
    when ((d.action_due - interval '1 second') at time zone 'Pacific/Auckland')::date <= d.today + 2 then 'soon'
    else 'ok'
  end as urgency,
  (case
     when d.next_action is null then 0
     when d.hold_code is not null then 900
     when d.action_due < now() then 1000 + least(500, (extract(epoch from now() - d.action_due) / 3600)::int)
     when ((d.action_due - interval '1 second') at time zone 'Pacific/Auckland')::date <= d.today then 500
     when ((d.action_due - interval '1 second') at time zone 'Pacific/Auckland')::date <= d.today + 2 then 200
     else 0
   end
   + case when d.handled_by is null and d.next_action is not null then 50 else 0 end
   + case when d.source = 'customer_portal' and d.stage = 'request' then 40 else 0 end
  ) as priority,
  d.handled_by, d.open_tasks,
  d.eta, d.etd, d.departed, d.arrived, d.last_free_day, d.delivered,
  d.cartage_booked, d.tms_id, d.tms_no, d.tms_status,
  d.quote_id, d.quote_no, d.shipment_id, d.erp_job
from d;

grant select on public.v_booking_flow to authenticated;

notify pgrst, 'reload schema';

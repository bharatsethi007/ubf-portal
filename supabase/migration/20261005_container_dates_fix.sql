-- Fix: customers saw zero container dates; gate-out trigger got no dates under service role.
-- Base logic moves to reporting.container_dates (non-exposed, owner bypasses RLS).
-- Idempotent. Run once in Supabase SQL editor.

drop view if exists public.portal_container_dates;
drop view if exists public.v_container_dates;
drop view if exists reporting.container_dates;

create view reporting.container_dates as
with base as (
  select b.id booking_id, b.booking_ref, b.module, b.shipment_id, b.archived_at, b.handled_by, b.ubf_devanner,
         coalesce(b.importer_account_id, b.account_id, b.consignee_account_id) customer_account_id,
         bc.container_no, coalesce(bc.container_type, ct.container_type) container_type,
         (ct.discharged_at at time zone 'Pacific/Auckland')::date discharged_on,
         (ct.available_at at time zone 'Pacific/Auckland')::date available_on,
         (ct.last_free_at at time zone 'Pacific/Auckland')::date port_last_free_day,
         (ct.gate_out_at at time zone 'Pacific/Auckland')::date gated_out_on,
         coalesce((ct.inbound_ata at time zone 'Pacific/Auckland')::date, s.arrived,
                  (ct.inbound_eta at time zone 'Pacific/Auckland')::date, s.eta, b.m_eta, b.eta) arrival_on,
         coalesce(b.detention_free_days, sl.detention_free_days, 7) detention_free_days,
         bc.planned_delivery_date, bc.delivery_window, bc.planned_return_date, bc.empty_ready_at,
         b.container_return_date empty_returned_on,
         (now() at time zone 'Pacific/Auckland')::date today
    from public.booking_containers bc
    join public.bookings b on b.id = bc.booking_id
    left join public.container_tracking ct on ct.booking_id = bc.booking_id and ct.container_no = bc.container_no
    left join public.shipping_lines sl on sl.code = b.shipping_line_code
    left join public.shipments s on s.job_unique = b.shipment_id
), calc as (
  select base.*,
         case when port_last_free_day is not null and coalesce(available_on, discharged_on) is not null
              then port_last_free_day - coalesce(available_on, discharged_on) + 1 end port_free_days,
         coalesce(discharged_on, arrival_on) + detention_free_days - 1 last_detention_day,
         discharged_on is null detention_is_estimate
    from base
)
select calc.*,
       last_detention_day - today days_to_detention,
       case when empty_returned_on is not null then 'returned'
            when last_detention_day is null then 'unknown'
            when detention_is_estimate and last_detention_day < today then 'unknown'
            when last_detention_day < today then 'overdue'
            when last_detention_day = today then 'today'
            when last_detention_day - today <= 3 then 'soon'
            else 'ok' end detention_status,
       case when gated_out_on is not null then 'collected'
            when port_last_free_day is null then 'unknown'
            when port_last_free_day < today then 'overdue'
            when port_last_free_day = today then 'today'
            when port_last_free_day - today <= 2 then 'soon'
            else 'ok' end port_status,
       (planned_return_date is not null and last_detention_day is not null and planned_return_date > last_detention_day) return_after_free_time
  from calc;
revoke all on reporting.container_dates from public, anon, authenticated;

create view public.v_container_dates as
  select * from reporting.container_dates where (select public.is_staff());
revoke all on public.v_container_dates from anon;
grant select on public.v_container_dates to authenticated;

create view public.portal_container_dates as
select booking_id, booking_ref, shipment_id, container_no, container_type,
       arrival_on, discharged_on, available_on, port_free_days, port_last_free_day, port_status,
       gated_out_on, detention_free_days, last_detention_day, detention_is_estimate, days_to_detention, detention_status,
       planned_delivery_date, delivery_window, planned_return_date, empty_ready_at, empty_returned_on, return_after_free_time
  from reporting.container_dates
 where archived_at is null and customer_account_id = public.my_account_id();
revoke all on public.portal_container_dates from anon;
grant select on public.portal_container_dates to authenticated;

create or replace function public.container_tracking_gate_out()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bk record; d record; v_acct text; v_due date; v_key text;
begin
  if new.gate_out_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.gate_out_at is not null then return new; end if;

  select * into bk from public.bookings where id = new.booking_id;
  if bk.id is null or bk.archived_at is not null or bk.module <> 'IS' then return new; end if;

  v_acct := coalesce(bk.importer_account_id, bk.account_id, bk.consignee_account_id);
  select * into d from reporting.container_dates where booking_id = new.booking_id and container_no = new.container_no;
  v_key := 'gate:' || new.booking_id || ':' || new.container_no;

  if v_acct is not null and exists (select 1 from public.portal_users where account_id = v_acct and status = 'active') then
    insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
    values (v_acct, bk.shipment_id, 'gated_out', v_key,
            new.container_no || ' collected from port',
            'Container ' || new.container_no || ' left the port on ' || to_char(new.gate_out_at at time zone 'Pacific/Auckland', 'FMDD Mon') || '.'
              || case when bk.ubf_devanner is null and d.last_detention_day is not null
                      then ' Free time ends ' || to_char(d.last_detention_day, 'FMDD Mon') || '. Tell us when the empty is ready.' else '' end,
            jsonb_build_object('booking_ref', bk.booking_ref, 'container', new.container_no, 'gated_out', new.gate_out_at,
                               'last_detention_day', d.last_detention_day, 'ref', bk.customer_ref))
    on conflict do nothing;
  end if;

  if bk.ubf_devanner is null and coalesce(bk.load_type, 'FCL') = 'FCL' and v_acct is not null then
    v_due := greatest(coalesce(d.last_detention_day - 2, (now() at time zone 'Pacific/Auckland')::date), (now() at time zone 'Pacific/Auckland')::date);
    insert into public.booking_tasks (booking_id, title, audience, kind, container_no, account_id, due_date, payload, auto_rule, status, sort_order, is_default)
    values (new.booking_id, 'Empty ready for pickup: ' || new.container_no, 'customer', 'empty_ready', new.container_no, v_acct, v_due,
            jsonb_build_object('last_detention_day', d.last_detention_day), 'empty_ready:' || new.container_no, 'open', 500, false)
    on conflict (booking_id, auto_rule) where auto_rule is not null do nothing;
  end if;

  perform public.staff_notify(bk.handled_by, new.booking_id, null, 'gated_out', new.container_no || ' gated out',
          coalesce(bk.booking_ref, '') || coalesce(' / ' || bk.importer_name, ''),
          jsonb_build_object('container', new.container_no, 'last_detention_day', d.last_detention_day), 'system', v_key);
  return new;
end $$;

notify pgrst, 'reload schema';

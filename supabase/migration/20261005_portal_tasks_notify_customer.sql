-- APPLIED LIVE 5 Oct 2026 (run by Bharat in SQL editor). Repo parity only. DO NOT RE-RUN.
-- Portal tasks: notify customer when staff push a task.
-- Gate-out auto tasks skipped (gate-out notice already asks for the empty).
-- Idempotent. Safe to run once in Supabase SQL editor.

create or replace function public.booking_tasks_notify_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare bk record;
begin
  if new.audience <> 'customer' or new.status <> 'open' or new.account_id is null then return new; end if;
  if new.auto_rule like 'empty_ready:%' then return new; end if;
  if not exists (select 1 from public.portal_users where account_id = new.account_id and status = 'active') then return new; end if;
  select booking_ref, shipment_id, customer_ref into bk from public.bookings where id = new.booking_id;
  insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
  values (new.account_id, bk.shipment_id, 'task_assigned', 'task:' || new.id,
          'Action needed: ' || new.title,
          coalesce(new.description || ' ', '') || coalesce('Booking ' || bk.booking_ref, '')
            || coalesce(', due ' || to_char(new.due_date, 'FMDD Mon'), '') || '.',
          jsonb_build_object('task_id', new.id, 'booking_id', new.booking_id, 'booking_ref', bk.booking_ref,
                             'kind', new.kind, 'due', new.due_date, 'ref', bk.customer_ref, 'container', new.container_no))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_booking_tasks_notify_customer on public.booking_tasks;
create trigger trg_booking_tasks_notify_customer after insert on public.booking_tasks
  for each row execute function public.booking_tasks_notify_customer();

notify pgrst, 'reload schema';

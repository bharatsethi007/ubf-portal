-- Booking expected costs (Phase 2). Applied 9 Oct 2026. Repo parity: do not re-run.

create table if not exists public.booking_costs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  cost_type text not null default 'other'
    check (cost_type in ('shipping_line','co_loader','psc','cartage','customs','agent','other')),
  vendor_name text,
  vendor_code text,
  charge_group text check (charge_group is null or charge_group in ('origin','freight','destination')),
  description text not null,
  qty numeric not null default 1,
  unit text,
  rate numeric,
  currency text not null default 'NZD',
  amount numeric not null default 0,
  fx_rate numeric not null default 1,
  amount_nzd numeric generated always as (round(amount * fx_rate, 2)) stored,
  source text not null default 'manual' check (source in ('quote','rate_card','manual')),
  source_ref jsonb,
  note text,
  sort_order int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists booking_costs_booking_idx on public.booking_costs(booking_id);

alter table public.booking_costs enable row level security;
drop policy if exists booking_costs_staff_all on public.booking_costs;
create policy booking_costs_staff_all on public.booking_costs
  for all to authenticated using (is_staff()) with check (is_staff());
grant select, insert, update, delete on public.booking_costs to authenticated;

create or replace function public.booking_costs_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare r booking_costs%rowtype; v_act text; v_old text; v_new text; v_uid uuid := auth.uid(); v_email text;
begin
  select email into v_email from staff_users where user_id = v_uid;
  if tg_op = 'DELETE' then r := old; v_act := 'cost_removed';
    v_old := concat_ws(' · ', old.vendor_name, old.description, old.currency || ' ' || old.amount);
  elsif tg_op = 'INSERT' then r := new; v_act := 'cost_added';
    v_new := concat_ws(' · ', new.vendor_name, new.description, new.currency || ' ' || new.amount);
  else
    r := new; new.updated_at := now();
    if (old.amount, old.currency, old.vendor_name, old.description) is not distinct from
       (new.amount, new.currency, new.vendor_name, new.description) then return new; end if;
    v_act := 'cost_updated';
    v_old := concat_ws(' · ', old.vendor_name, old.description, old.currency || ' ' || old.amount);
    v_new := concat_ws(' · ', new.vendor_name, new.description, new.currency || ' ' || new.amount);
  end if;
  insert into booking_history (booking_id, field, old_value, new_value, action, actor_id, actor_name)
  values (r.booking_id, 'cost', v_old, v_new, v_act, case when v_email is null then null else v_uid end, v_email);
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists trg_booking_costs_log_aiud on public.booking_costs;
drop trigger if exists trg_booking_costs_log_bu on public.booking_costs;
create trigger trg_booking_costs_log_aiud after insert or delete on public.booking_costs
  for each row execute function public.booking_costs_log();
create trigger trg_booking_costs_log_bu before update on public.booking_costs
  for each row execute function public.booking_costs_log();

notify pgrst, 'reload schema';

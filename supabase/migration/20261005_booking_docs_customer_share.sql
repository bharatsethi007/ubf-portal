-- REPO PARITY ONLY. Already applied live 5 Oct 2026. Do not re-run.
-- Booking documents shared with customers. Staff docs hidden by default (staff toggles customer_visible).
-- Customer uploads always visible (trigger). Portal RLS: shared docs on own bookings only.
alter table public.booking_documents add column if not exists customer_visible boolean not null default false;
alter table public.booking_documents add column if not exists uploaded_via text not null default 'staff';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'booking_documents_uploaded_via_chk') then
    alter table public.booking_documents add constraint booking_documents_uploaded_via_chk check (uploaded_via in ('staff','customer'));
  end if;
end $$;

create or replace function public.portal_can_see_booking(p_booking_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings b
    where b.id = p_booking_id and b.archived_at is null
      and public.my_account_id() is not null
      and public.my_account_id() in (b.account_id, b.consignee_account_id, b.importer_account_id)
  );
$$;
revoke all on function public.portal_can_see_booking(uuid) from public, anon;
grant execute on function public.portal_can_see_booking(uuid) to authenticated, service_role;

create or replace function public.trg_booking_docs_customer_visible()
returns trigger language plpgsql as $$
begin
  if new.uploaded_via = 'customer' then new.customer_visible := true; end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_booking_docs_customer_visible') then
    create trigger trg_booking_docs_customer_visible before insert or update on public.booking_documents
      for each row execute function public.trg_booking_docs_customer_visible();
  end if;
end $$;

alter policy portal_select_booking_docs on public.booking_documents to authenticated
  using (customer_visible and public.portal_can_see_booking(booking_id));
alter policy portal_insert_booking_docs on public.booking_documents to authenticated
  with check (uploaded_via = 'customer' and uploaded_by = auth.uid() and public.portal_can_see_booking(booking_id));

notify pgrst, 'reload schema';

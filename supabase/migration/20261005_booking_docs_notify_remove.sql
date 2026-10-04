-- REPO PARITY ONLY. Already applied live 5 Oct 2026. Do not re-run.
-- 1) portal_notifications: allow kind 'document_shared'.
-- 2) booking_docs_notify trigger: staff share -> customer notification + digest; customer upload -> portal-doc-notify (team email).
-- 3) portal_doc_notify_payload (service only) for the staff email.
-- 4) portal_remove_document: customer deletes own upload only. UBF docs cannot be removed from the portal.

alter table public.portal_notifications drop constraint if exists portal_notifications_kind_check;
alter table public.portal_notifications add constraint portal_notifications_kind_check
  check (kind = any (array['shipment_created','eta_changed','departed','arrived','released','invoice_issued','message','quote_ready','document_shared']));

create or replace function public.booking_docs_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b record;
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  key text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  hdr jsonb;
  n int;
begin
  hdr := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key);
  if new.uploaded_via = 'customer' then
    if tg_op = 'INSERT' and base is not null then
      perform net.http_post(url := base || '/functions/v1/portal-doc-notify', headers := hdr,
        body := jsonb_build_object('document_id', new.id), timeout_milliseconds := 30000);
    end if;
    return new;
  end if;
  if new.customer_visible and (tg_op = 'INSERT' or not coalesce(old.customer_visible, false)) then
    select id, booking_ref, shipment_id, account_id, importer_account_id, consignee_account_id
      into b from bookings where id = new.booking_id;
    insert into portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
    select distinct a.acct, b.shipment_id, 'document_shared', 'doc:' || new.id,
           'New document: ' || new.file_name,
           'UB Freight shared ' || new.file_name || coalesce(' on booking ' || b.booking_ref, '') || '.',
           jsonb_build_object('booking_id', b.id, 'document_id', new.id, 'file_name', new.file_name, 'booking_ref', b.booking_ref)
      from (values (b.account_id), (b.importer_account_id), (b.consignee_account_id)) a(acct)
     where a.acct is not null
       and exists (select 1 from portal_users pu where pu.account_id = a.acct and pu.status = 'active')
    on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 and base is not null then
      perform net.http_post(url := base || '/functions/v1/portal-notify-send', headers := hdr,
        body := '{}'::jsonb, timeout_milliseconds := 60000);
    end if;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_booking_docs_notify') then
    create trigger trg_booking_docs_notify after insert or update of customer_visible on public.booking_documents
      for each row execute function public.booking_docs_notify();
  end if;
end $$;

create or replace function public.portal_doc_notify_payload(p_doc uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'document_id', d.id, 'file_name', d.file_name, 'size_bytes', d.size_bytes, 'created_at', d.created_at,
    'booking_id', b.id, 'booking_ref', b.booking_ref, 'module', b.module, 'shipment_id', b.shipment_id,
    'account_id', pu.account_id, 'customer', c.name, 'uploader_email', pu.email,
    'handler_email', su.email)
  from booking_documents d
  join bookings b on b.id = d.booking_id
  left join portal_users pu on pu.user_id = d.uploaded_by
  left join customers c on c.account_id = pu.account_id
  left join staff_users su on su.user_id = b.handled_by
  where d.id = p_doc and d.uploaded_via = 'customer';
$$;
revoke all on function public.portal_doc_notify_payload(uuid) from public, anon, authenticated;
grant execute on function public.portal_doc_notify_payload(uuid) to service_role;

create or replace function public.portal_remove_document(p_doc uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from booking_documents where id = p_doc;
  if d.id is null or d.uploaded_via <> 'customer' or not portal_can_see_booking(d.booking_id) then
    raise exception 'not allowed';
  end if;
  delete from booking_documents where id = p_doc;
  return jsonb_build_object('deleted', true, 'storage_path', d.storage_path);
end $$;
revoke all on function public.portal_remove_document(uuid) from public, anon;
grant execute on function public.portal_remove_document(uuid) to authenticated;

notify pgrst, 'reload schema';

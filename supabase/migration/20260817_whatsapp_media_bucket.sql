-- Private bucket for inbound WhatsApp media (packing lists, photos). Service role writes; staff read.
-- Applied live 2026-08-17.

insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

drop policy if exists staff_read_whatsapp_media on storage.objects;
create policy staff_read_whatsapp_media on storage.objects
  for select to authenticated
  using (bucket_id = 'whatsapp-media' and public.is_staff());

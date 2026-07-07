-- 20260629_sli_storage_policy.sql
-- Allow anonymous (public SLI page) uploads to sli-uploads, but ONLY into a
-- folder named after a valid, non-expired, not-yet-endorsed SLI token.
-- Path convention: '{token}/{filename}'. The token is the access secret.
-- Project cpnkudbdzgnzmodhsrbf. Apply via Supabase MCP apply_migration.

-- INSERT (upload). First path segment must be a live SLI token.
drop policy if exists sli_anon_upload on storage.objects;
create policy sli_anon_upload on storage.objects
  for insert to anon
  with check (
    bucket_id = 'sli-uploads'
    and exists (
      select 1 from public.sli_documents d
      where d.token = (storage.foldername(name))[1]
        and d.status not in ('expired','endorsed')
        and d.expires_at > now()
    )
  );

-- Allow the same anon session to read back what it just uploaded (preview),
-- scoped to a live token folder.
drop policy if exists sli_anon_read on storage.objects;
create policy sli_anon_read on storage.objects
  for select to anon
  using (
    bucket_id = 'sli-uploads'
    and exists (
      select 1 from public.sli_documents d
      where d.token = (storage.foldername(name))[1]
        and d.expires_at > now()
    )
  );

-- Note: no anon update/delete. Staff/service-role retain full access by default
-- (service role bypasses RLS; the Edge Functions and staff app use it).

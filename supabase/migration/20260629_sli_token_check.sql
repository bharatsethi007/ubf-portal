-- 20260629_sli_token_check.sql
-- Fix anon upload to sli-uploads: storage policy can't read staff-only sli_documents.
-- A SECURITY DEFINER function validates the token folder without exposing the table.
-- Project cpnkudbdzgnzmodhsrbf. Apply via Supabase MCP apply_migration.

create or replace function public.sli_token_is_live(p_token text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from sli_documents d
    where d.token = p_token
      and d.status not in ('expired','endorsed')
      and d.expires_at > now()
  );
$$;

-- a looser variant for read-back (allows endorsed, just not expired)
create or replace function public.sli_token_exists(p_token text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from sli_documents d
    where d.token = p_token and d.expires_at > now()
  );
$$;

grant execute on function public.sli_token_is_live(text) to anon;
grant execute on function public.sli_token_exists(text) to anon;

-- rebuild storage policies to use the definer helpers
drop policy if exists sli_anon_upload on storage.objects;
create policy sli_anon_upload on storage.objects
  for insert to anon
  with check (
    bucket_id = 'sli-uploads'
    and public.sli_token_is_live((storage.foldername(name))[1])
  );

drop policy if exists sli_anon_read on storage.objects;
create policy sli_anon_read on storage.objects
  for select to anon
  using (
    bucket_id = 'sli-uploads'
    and public.sli_token_exists((storage.foldername(name))[1])
  );

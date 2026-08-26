-- ============================================================
-- TMS address-book duplicate detection (trigram).
-- Applied live to cpnkudbdzgnzmodhsrbf on 26 Aug 2026 via MCP.
-- Repo-parity copy for supabase/migration.
-- ============================================================

create extension if not exists pg_trgm;
create index if not exists tms_address_book_company_trgm on public.tms_address_book using gin (company_name gin_trgm_ops);

-- near-duplicate name pairs (security invoker -> address-book RLS applies)
create or replace function public.tms_address_book_dupes(threshold real default 0.45)
returns table(a_id uuid, a_company text, a_address text, b_id uuid, b_company text, b_address text, sim real)
language sql stable as $$
  select a.id, a.company_name, a.address, b.id, b.company_name, b.address, similarity(a.company_name, b.company_name)
  from public.tms_address_book a
  join public.tms_address_book b
    on a.id < b.id and similarity(a.company_name, b.company_name) >= threshold
  order by similarity(a.company_name, b.company_name) desc
  limit 200
$$;
grant execute on function public.tms_address_book_dupes(real) to authenticated;
notify pgrst, 'reload schema';

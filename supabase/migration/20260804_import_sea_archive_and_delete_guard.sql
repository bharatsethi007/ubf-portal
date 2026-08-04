-- Import Sea board: archive (reversible) + hard-delete guard.
-- Applied live 2026-08-04.

alter table public.bookings
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.staff_users(user_id);

create index if not exists bookings_sea_import_active_idx
  on public.bookings (mode)
  where archived_at is null;

-- Restrictive => ANDed with staff_all_bookings USING(is_staff()).
-- Net: delete requires is_staff() AND shipment_id IS NULL (can't delete ERP-matched jobs).
drop policy if exists bookings_block_delete_matched on public.bookings;
create policy bookings_block_delete_matched
  on public.bookings as restrictive for delete to public
  using (shipment_id is null);

-- get_import_sea_board gains p_include_archived; return type changes -> drop+recreate.
-- Row fn depends on board fn, drop it first.
drop function if exists public.get_import_sea_board_row(uuid);
drop function if exists public.get_import_sea_board();
-- NOTE: full function bodies applied via Supabase MCP; the two changes vs the prior version are:
--   1) signature: get_import_sea_board(p_include_archived boolean default false)
--   2) SELECT adds b.archived_at, b.archived_by; WHERE adds "AND (p_include_archived OR b.archived_at IS NULL)"
--   3) get_import_sea_board_row calls get_import_sea_board(true)

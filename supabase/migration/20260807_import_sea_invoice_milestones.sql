-- Two new manual UBF milestone flags on bookings, mirroring the existing ones.
alter table public.bookings
  add column if not exists inv_approved boolean default false,
  add column if not exists inv_sent boolean default false;

-- Board RPCs must expose the two new flags. Signature change -> drop + recreate.
drop function if exists public.get_import_sea_board_row(uuid);
drop function if exists public.get_import_sea_board(boolean);

-- (recreate get_import_sea_board and get_import_sea_board_row with inv_approved, inv_sent
--  added immediately after truck_booked in both the RETURNS TABLE and the SELECT list;
--  bodies otherwise identical to the previous definitions.)

-- Bill-to can be an agent account (e.g. UBNAN, UBF Fiji) that is in the ERP account list but not in customers.
-- Drop the customers FK on bookings.bill_to_account_id. Idempotent.
alter table public.bookings drop constraint if exists bookings_bill_to_account_id_fkey;
notify pgrst, 'reload schema';

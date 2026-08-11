-- 20260811_rate_cards_provider_allow_vendor
-- A rate card's "provider" may now be a vendor (from customers/contacts),
-- not only a shipping line / co-loader — so vendor-only cards validate.
-- Repo-parity only — applied live via apply_migration; do not re-run via CLI.
alter table public.rate_cards
  drop constraint if exists rate_cards_provider_present;

alter table public.rate_cards
  add constraint rate_cards_provider_present
  check (
    vendor_account_id is not null
    or (rate_type = 'lcl' and co_loader_code is not null)
    or (rate_type <> 'lcl' and shipping_line_code is not null)
  );

notify pgrst, 'reload schema';

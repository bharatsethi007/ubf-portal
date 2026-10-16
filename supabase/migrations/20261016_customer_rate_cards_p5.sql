-- Rate card presentation: add Freight only.
alter table customer_rate_cards drop constraint if exists customer_rate_cards_presentation_check;
alter table customer_rate_cards add constraint customer_rate_cards_presentation_check
  check (presentation in ('freight', 'all_in', 'breakdown', 'both'));

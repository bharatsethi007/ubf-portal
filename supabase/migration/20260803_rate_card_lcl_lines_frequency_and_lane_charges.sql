alter table public.rate_card_lcl_lines
  add column if not exists frequency   text,
  add column if not exists lane_charges jsonb not null default '[]'::jsonb;

-- Applied live via MCP 1 Oct 2026 (migration rate_card_fixed_margin). Idempotent.
-- Card default margin can be % (default_markup_pct) or a fixed amount per unit (default_margin_fixed).
-- Lines can override with their own margin (type + value); blank = use the card default.
-- Sell resolution: explicit line sell > line margin > card margin > cost.
alter table public.rate_cards
  add column if not exists default_margin_type text not null default 'pct',
  add column if not exists default_margin_fixed numeric;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rate_cards_default_margin_type_check') then
    alter table public.rate_cards add constraint rate_cards_default_margin_type_check check (default_margin_type in ('pct','fixed'));
  end if;
end $$;

alter table public.rate_card_fcl_lines add column if not exists margin_type text, add column if not exists margin_value numeric;
alter table public.rate_card_lcl_lines add column if not exists margin_type text, add column if not exists margin_value numeric;
alter table public.rate_card_air_lines add column if not exists margin_type text, add column if not exists margin_value numeric;

do $$
declare t text;
begin
  foreach t in array array['rate_card_fcl_lines','rate_card_lcl_lines','rate_card_air_lines'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_margin_type_check') then
      execute format('alter table public.%I add constraint %I check (margin_type is null or margin_type in (''pct'',''fixed''))', t, t || '_margin_type_check');
    end if;
  end loop;
end $$;

update public.rate_card_air_lines
   set margin_type = 'pct', margin_value = markup_pct
 where markup_pct is not null and margin_type is null;

notify pgrst, 'reload schema';

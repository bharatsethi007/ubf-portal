-- Quote numbers: AKL-Q-00239 style (5 digits). Existing quotes keep their old numbers.
-- Sequence continues, so no duplicates.
create or replace function public.gen_quote_no()
returns trigger language plpgsql as $$
begin
  if new.quote_no is null or new.quote_no = '' then
    new.quote_no := 'AKL-Q-' || lpad(nextval('public.quote_no_seq')::text, 5, '0');
  end if;
  return new;
end; $$;

-- Check: next number preview (does not consume the sequence)
select 'AKL-Q-' || lpad((last_value + 1)::text, 5, '0') as next_quote_no from public.quote_no_seq;

-- Tighter job matching: whole-word refs only, numeric job numbers ignored, customer refs need letters + digits.
-- Housekeeping cron: select cron.schedule('inbox-auto-close', '23 * * * *', 'select public.inbox_auto_close()');
create or replace function public.inbox_word_in(p_needle text, p_text text)
returns boolean language sql immutable as $$
  select length(coalesce(p_needle, '')) > 0
     and p_text ~ ('(^|[^A-Z0-9])' || regexp_replace(upper(p_needle), '([^A-Z0-9])', '\\\1', 'g') || '($|[^A-Z0-9])')
$$;

create or replace function public.inbox_find_job(p_text text)
returns uuid language plpgsql stable security definer set search_path to 'public' as $$
declare t text := upper(left(coalesce(p_text, ''), 20000)); tt text; ids uuid[];
begin
  if length(t) < 8 then return null; end if;
  tt := regexp_replace(t, '[\s\-/]', '', 'g');
  select array_agg(distinct id) into ids from (
    select bc.booking_id id from public.booking_containers bc
     where bc.container_no in (select (regexp_matches(t, '[A-Z]{4}\d{7}', 'g'))[1])
    union
    select b.id from public.bookings b
     where b.archived_at is null and (
           (length(b.mbl_no) >= 8 and public.inbox_word_in(b.mbl_no, t))
        or (length(b.hawb) >= 8 and public.inbox_word_in(b.hawb, t))
        or (length(regexp_replace(coalesce(b.mawb, ''), '\D', '', 'g')) = 11 and position(regexp_replace(b.mawb, '\D', '', 'g') in tt) > 0)
        or (b.job_no ~ '[A-Za-z]' and length(b.job_no) >= 5 and public.inbox_word_in(b.job_no, t))
        or (length(b.customer_ref) >= 6 and b.customer_ref ~ '[A-Za-z]' and b.customer_ref ~ '\d' and public.inbox_word_in(b.customer_ref, t)))
  ) x;
  return case when array_length(ids, 1) = 1 then ids[1] end;
end $$;

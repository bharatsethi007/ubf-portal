-- Quotes: copy_quote RPC + period stats (week from Monday / month / quarter / year, NZ time).
create or replace function public.copy_quote(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_new uuid := gen_random_uuid();
  v_j jsonb;
  r record;
  v_resp uuid;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  select to_jsonb(q) into v_j from quotes q where q.id = p_id;
  if v_j is null then raise exception 'quote not found'; end if;
  v_j := v_j || jsonb_build_object(
    'id', v_new, 'quote_no', null, 'status', 'open', 'booking_id', null,
    'source', 'manual', 'source_meta', jsonb_build_object('copied_from', p_id),
    'created_by', auth.uid(), 'created_at', now(), 'updated_at', now(),
    'pickup_date', null, 'delivery_date', null);
  insert into quotes select * from jsonb_populate_record(null::quotes, v_j);
  insert into quote_cargo_lines
  select (jsonb_populate_record(null::quote_cargo_lines,
    to_jsonb(c) || jsonb_build_object('id', gen_random_uuid(), 'quote_id', v_new, 'created_at', now()))).*
  from quote_cargo_lines c where c.quote_id = p_id;
  insert into quote_containers
  select (jsonb_populate_record(null::quote_containers,
    to_jsonb(c) || jsonb_build_object('id', gen_random_uuid(), 'quote_id', v_new, 'created_at', now()))).*
  from quote_containers c where c.quote_id = p_id;
  for r in select * from quote_responses where quote_id = p_id order by created_at loop
    v_resp := gen_random_uuid();
    insert into quote_responses
    select * from jsonb_populate_record(null::quote_responses, to_jsonb(r) || jsonb_build_object(
      'id', v_resp, 'quote_id', v_new, 'response_no', null, 'status', 'draft',
      'quotation_date', current_date, 'valid_from', null, 'valid_till', null, 'etd', null, 'eta', null,
      'sent_to_portal_at', null, 'sent_by', null, 'decided_at', null, 'decided_by', null, 'decision_note', null,
      'created_by', auth.uid(), 'created_at', now(), 'updated_at', now()));
    insert into quote_response_lines
    select (jsonb_populate_record(null::quote_response_lines,
      to_jsonb(l) || jsonb_build_object('id', gen_random_uuid(), 'response_id', v_resp, 'created_at', now()))).*
    from quote_response_lines l where l.response_id = r.id;
  end loop;
  return v_new;
end $$;
grant execute on function public.copy_quote(uuid) to authenticated;

drop function if exists public.quotes_stats(text, text, text);
drop function if exists public.quotes_stats(text, text, text, text);
create function public.quotes_stats(
  p_mode text default 'all', p_from text default null, p_to text default null, p_period text default 'month')
returns table(period_count integer, open integer, needs_pricing integer, won_period integer, lost_period integer, win_rate numeric)
language sql stable
set search_path to 'public'
as $$
  with b as (
    select (date_trunc(case when p_period in ('week','month','quarter','year') then p_period else 'month' end,
            now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland') as since
  ), q as (
    select x.id, x.status, x.created_at, x.updated_at
    from quotes x
    where (coalesce(p_mode,'all') = 'all'
        or (p_mode = 'air' and (x.shipment_type ilike 'air' or x.shipment_mode ilike '%air%'))
        or (p_mode = 'fcl' and x.shipment_type ilike 'fcl')
        or (p_mode = 'lcl' and x.shipment_type ilike 'lcl'))
      and (p_from is null or x.from_port_code = upper(p_from))
      and (p_to is null or x.to_port_code = upper(p_to))
  )
  select
    count(q.id) filter (where q.created_at >= b.since)::int,
    count(q.id) filter (where q.status = 'open')::int,
    count(q.id) filter (where q.status = 'open' and not exists (select 1 from quote_responses r where r.quote_id = q.id))::int,
    count(q.id) filter (where q.status in ('won','crosswin') and q.updated_at >= b.since)::int,
    count(q.id) filter (where q.status = 'lost' and q.updated_at >= b.since)::int,
    round(100.0 * count(q.id) filter (where q.status in ('won','crosswin') and q.updated_at >= b.since)
      / nullif(count(q.id) filter (where q.status in ('won','crosswin','lost') and q.updated_at >= b.since), 0), 0)
  from b left join q on true
  group by b.since;
$$;
grant execute on function public.quotes_stats(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- Quote transit time as free text ("3-5", "5-7 days", "Weekly"). Integer column kept in sync for sorting/fastest.
alter table public.quote_responses add column if not exists transit_time text;

create or replace function public.quote_responses_transit_sync()
returns trigger language plpgsql set search_path to 'public' as $$
declare v_num text;
begin
  if tg_op = 'INSERT' then
    if nullif(trim(new.transit_time), '') is not null then
      v_num := substring(new.transit_time from '\d+');
      new.transit_time_days := case when v_num is null then null else least(v_num::int, 999) end;
    elsif new.transit_time_days is not null then
      new.transit_time := new.transit_time_days::text;
    end if;
  else
    if new.transit_time is distinct from old.transit_time then
      new.transit_time := nullif(trim(new.transit_time), '');
      v_num := substring(coalesce(new.transit_time, '') from '\d+');
      new.transit_time_days := case when v_num is null or v_num = '' then null else least(v_num::int, 999) end;
    elsif new.transit_time_days is distinct from old.transit_time_days then
      new.transit_time := new.transit_time_days::text;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_quote_responses_transit_sync on public.quote_responses;
create trigger trg_quote_responses_transit_sync before insert or update on public.quote_responses
  for each row execute function public.quote_responses_transit_sync();

update public.quote_responses set transit_time = transit_time_days::text
 where transit_time is null and transit_time_days is not null;

-- Portal: expose the text (new column appended, existing columns unchanged).
create or replace view public.portal_quote_offers as
 SELECT r.id,
    r.response_no,
    q.id AS quote_id,
    q.quote_no,
    q.shipment_mode,
    q.shipment_type,
    q.from_port_code,
    q.to_port_code,
    q.customer_po,
    q.incoterms,
    ( SELECT l.cargo_description FROM quote_cargo_lines l WHERE l.quote_id = q.id ORDER BY l.ord LIMIT 1) AS goods,
    ( SELECT string_agg(((c.qty || ' x '::text) || c.container_size) ||
                CASE WHEN c.container_type <> 'standard'::text THEN ' '::text || c.container_type ELSE ''::text END, ', '::text ORDER BY c.ord) AS string_agg
           FROM quote_containers c WHERE c.quote_id = q.id) AS containers,
    r.carrier,
    r.via_port,
    r.transit_time_days,
    r.etd,
    r.eta,
    r.valid_from,
    r.valid_till,
    r.origin_free_time_days,
    r.detention_free_time_dest,
    r.currency,
    r.sub_total,
    r.total_tax,
    r.total_sell,
    r.customer_notes,
    r.terms_conditions,
        CASE
            WHEN r.status = 'sent_for_approval'::text AND r.valid_till IS NOT NULL AND r.valid_till < CURRENT_DATE THEN 'expired'::text
            WHEN r.status = 'sent_for_approval'::text THEN 'pending'::text
            ELSE r.status
        END AS portal_status,
    r.sent_to_portal_at AS sent_at,
    r.decided_at,
    r.decision_note,
    ( SELECT COALESCE(pu.display_name, pu.email) AS "coalesce" FROM portal_users pu WHERE pu.user_id = r.decided_by) AS decided_by_name,
    q.booking_id,
    ( SELECT b.booking_ref FROM bookings b WHERE b.id = q.booking_id) AS booking_ref,
    q.source_meta ->> 'direction'::text AS direction,
    ( SELECT l.gross_wt FROM quote_cargo_lines l WHERE l.quote_id = q.id ORDER BY l.ord LIMIT 1) AS weight_kg,
    ( SELECT l.volume_cbm FROM quote_cargo_lines l WHERE l.quote_id = q.id ORDER BY l.ord LIMIT 1) AS cbm,
    ( SELECT l.packages FROM quote_cargo_lines l WHERE l.quote_id = q.id ORDER BY l.ord LIMIT 1) AS pieces,
    q.pickup_date AS cargo_ready_date,
    q.is_hazardous,
    q.need_refrigeration,
    ( SELECT c.container_size ||
                CASE WHEN c.container_type <> 'standard'::text THEN ' '::text || c.container_type ELSE ''::text END
           FROM quote_containers c WHERE c.quote_id = q.id ORDER BY c.ord LIMIT 1) AS container_type,
    ( SELECT sum(c.qty) AS sum FROM quote_containers c WHERE c.quote_id = q.id) AS container_count,
    r.transit_time
   FROM quote_responses r
     JOIN quotes q ON q.id = r.quote_id
  WHERE q.customer_account_id = my_account_id() AND r.sent_to_portal_at IS NOT NULL
    AND (r.status = ANY (ARRAY['sent_for_approval'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text, 'crosswin'::text]));

-- Customer accept/decline page: send the text.
create or replace function public.quote_public_view(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare rm quote_reminders; q quotes; v jsonb;
begin
  select * into rm from quote_reminders where token = p_token;
  if rm.id is null then return jsonb_build_object('error', 'not_found'); end if;
  select * into q from quotes where id = rm.quote_id;
  if q.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if rm.opened_at is null then update quote_reminders set opened_at = now() where id = rm.id; end if;
  select jsonb_build_object(
    'quote_no', q.quote_no, 'customer_name', q.customer_name, 'status', q.status,
    'expires_at', q.expires_at, 'lost_reason', q.lost_reason,
    'mode', q.shipment_mode, 'type', q.shipment_type, 'movement', q.movement_type, 'incoterms', q.incoterms,
    'from_code', q.from_port_code, 'to_code', q.to_port_code,
    'from_name', (select p.name from ports p where p.code = q.from_port_code limit 1),
    'to_name', (select p.name from ports p where p.code = q.to_port_code limit 1),
    'owner_name', (select coalesce(nullif(full_name, ''), email) from staff_users where user_id = q.created_by),
    'owner_email', (select email from staff_users where user_id = q.created_by),
    'decided', rm.decision,
    'options', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id,
        -- LCL co-loaders are never shown to customers.
        'carrier', case when q.shipment_type ilike 'lcl' then null else r.carrier end,
        'product', r.product, 'via', r.via_port,
        'transit_days', coalesce(r.transit_time, r.transit_time_days::text), 'total', r.total_sell, 'currency', r.currency,
        'valid_till', r.valid_till, 'status', r.status) order by r.total_sell)
      from quote_responses r where r.quote_id = q.id and coalesce(r.total_sell, 0) > 0
        and r.status not in ('rejected','withdrawn')), '[]'::jsonb)
  ) into v;
  return v;
end $$;

notify pgrst, 'reload schema';

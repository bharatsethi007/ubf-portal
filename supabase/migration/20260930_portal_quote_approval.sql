-- Portal quote approval (applied via Supabase MCP 30 Sep 2026; repo parity, do not re-run).
-- Staff send a priced quote_response to the customer portal; the customer approves or rejects it there.
-- Customer sees sell side only through two views; buy/vendor/margin never leave the console.

alter table public.quote_responses
  add column if not exists sent_to_portal_at timestamptz,
  add column if not exists sent_by uuid,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid,
  add column if not exists decision_note text;

alter table public.quote_responses drop constraint if exists quote_responses_status_check;
alter table public.quote_responses add constraint quote_responses_status_check
  check (status = any (array['draft','published','sent_for_approval','approved','rejected','withdrawn']));

alter table public.portal_notifications drop constraint if exists portal_notifications_kind_check;
alter table public.portal_notifications add constraint portal_notifications_kind_check
  check (kind = any (array['shipment_created','eta_changed','departed','arrived','released','invoice_issued','message','quote_ready']));

drop view if exists public.portal_quote_offer_lines;
drop view if exists public.portal_quote_offers;

create view public.portal_quote_offers as
select r.id, r.response_no, q.id as quote_id, q.quote_no,
       q.shipment_mode, q.shipment_type, q.from_port_code, q.to_port_code, q.customer_po, q.incoterms,
       (select l.cargo_description from public.quote_cargo_lines l where l.quote_id = q.id order by l.ord limit 1) as goods,
       (select string_agg(c.qty || ' x ' || c.container_size || case when c.container_type <> 'standard' then ' ' || c.container_type else '' end, ', ' order by c.ord)
          from public.quote_containers c where c.quote_id = q.id) as containers,
       r.carrier, r.via_port, r.transit_time_days, r.etd, r.eta, r.valid_from, r.valid_till,
       r.origin_free_time_days, r.detention_free_time_dest,
       r.currency, r.sub_total, r.total_tax, r.total_sell, r.customer_notes, r.terms_conditions,
       case
         when r.status = 'sent_for_approval' and r.valid_till is not null and r.valid_till < current_date then 'expired'
         when r.status = 'sent_for_approval' then 'pending'
         else r.status
       end as portal_status,
       r.sent_to_portal_at as sent_at, r.decided_at, r.decision_note,
       (select coalesce(pu.display_name, pu.email) from public.portal_users pu where pu.user_id = r.decided_by) as decided_by_name
  from public.quote_responses r
  join public.quotes q on q.id = r.quote_id
 where q.customer_account_id = public.my_account_id()
   and r.sent_to_portal_at is not null
   and r.status in ('sent_for_approval','approved','rejected','withdrawn');

create view public.portal_quote_offer_lines as
select l.id, l.response_id, l.ord, coalesce(l.charge_group, 'freight') as charge_group, l.description, l.unit, l.qty,
       l.sell_currency, l.sell_rate, l.min_sell, l.ex_rate_sell, l.total_sell, l.tax
  from public.quote_response_lines l
 where l.response_id in (select o.id from public.portal_quote_offers o)
   and coalesce(l.total_sell, 0) <> 0;

revoke all on public.portal_quote_offers, public.portal_quote_offer_lines from anon;
grant select on public.portal_quote_offers, public.portal_quote_offer_lines to authenticated;

-- Staff: send a response to the customer portal (queues a quote_ready notification)
create or replace function public.quote_response_send(p_response uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r public.quote_responses; q public.quotes;
begin
  if not public.is_staff() or not public.has_perm('quotes','edit') then raise exception 'Not allowed'; end if;
  select * into r from public.quote_responses where id = p_response for update;
  if r.id is null then raise exception 'Response not found'; end if;
  select * into q from public.quotes where id = r.quote_id;
  if q.customer_account_id is null then raise exception 'Pick a customer account on the quote first'; end if;
  if not exists (select 1 from public.customers where account_id = q.customer_account_id) then raise exception 'Customer account not found'; end if;
  if r.status not in ('draft','published','withdrawn') then raise exception 'Already sent'; end if;
  if coalesce(r.total_sell, 0) <= 0 then raise exception 'Response has no sell total'; end if;
  if r.valid_till is not null and r.valid_till < current_date then raise exception 'Validity has passed. Update valid till first'; end if;

  update public.quote_responses
     set status = 'sent_for_approval', sent_to_portal_at = now(), sent_by = auth.uid(),
         decided_at = null, decided_by = null, decision_note = null
   where id = p_response;
  update public.quotes set status = 'sent' where id = q.id and status in ('open','published');

  insert into public.portal_notifications (account_id, kind, dedupe_key, title, body, facts)
  values (q.customer_account_id, 'quote_ready', 'quote:' || r.id || ':' || extract(epoch from now())::bigint,
          'Quote ' || coalesce(r.response_no, q.quote_no) || ' is ready',
          q.from_port_code || ' to ' || q.to_port_code || ' · ' || coalesce(r.currency, 'NZD') || ' ' || to_char(r.total_sell, 'FM999,999,990.00')
            || case when r.valid_till is not null then ' · valid to ' || to_char(r.valid_till, 'DD Mon YYYY') else '' end,
          jsonb_build_object('response_id', r.id, 'quote_id', q.id, 'ref', q.customer_po))
  on conflict do nothing;

  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-notify-send',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body := '{}'::jsonb, timeout_milliseconds := 60000);
  exception when others then
    raise warning 'quote_response_send notify: %', sqlerrm;
  end;
end $$;

-- Staff: pull a sent response back before the customer answers
create or replace function public.quote_response_withdraw(p_response uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_staff() or not public.has_perm('quotes','edit') then raise exception 'Not allowed'; end if;
  update public.quote_responses set status = 'withdrawn'
   where id = p_response and status = 'sent_for_approval';
  if not found then raise exception 'Only a response waiting on the customer can be withdrawn'; end if;
end $$;

-- Customer: approve or reject (approve closes sibling offers, marks quote won; last reject marks quote lost)
create or replace function public.portal_quote_respond(p_response uuid, p_decision text, p_note text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare acct text := public.my_account_id(); r public.quote_responses; q public.quotes; v_new text;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Choose approve or reject'; end if;
  select * into r from public.quote_responses where id = p_response for update;
  select * into q from public.quotes where id = r.quote_id;
  if r.id is null or q.customer_account_id is distinct from acct or r.sent_to_portal_at is null then raise exception 'Quote not found'; end if;
  if r.status <> 'sent_for_approval' then raise exception 'This quote has already been answered'; end if;
  if p_decision = 'approve' and r.valid_till is not null and r.valid_till < current_date then
    raise exception 'This quote has expired. Ask us to refresh it';
  end if;
  if p_decision = 'reject' and coalesce(trim(p_note), '') = '' then raise exception 'Tell us why so we can improve it'; end if;

  v_new := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  update public.quote_responses
     set status = v_new, decided_at = now(), decided_by = auth.uid(), decision_note = nullif(trim(p_note), '')
   where id = r.id;

  if v_new = 'approved' then
    update public.quote_responses set status = 'withdrawn'
     where quote_id = q.id and id <> r.id and status = 'sent_for_approval';
    update public.quotes set status = 'won' where id = q.id;
  elsif not exists (select 1 from public.quote_responses where quote_id = q.id and status in ('sent_for_approval','approved')) then
    update public.quotes set status = 'lost' where id = q.id and status in ('open','published','sent');
  end if;

  perform public.portal_booking_notify_queue(r.id, 'quote_' || v_new);
  return v_new;
end $$;

-- Payload for the staff email (portal-booking-notify, events quote_approved / quote_rejected)
create or replace function public.portal_quote_decision_payload(p_response uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', q.id, 'response_id', r.id, 'response_no', r.response_no, 'quote_no', q.quote_no,
    'mode', q.shipment_mode, 'type', q.shipment_type, 'origin', q.from_port_code, 'destination', q.to_port_code,
    'direction', q.source_meta->>'direction', 'account_id', q.customer_account_id, 'customer_name', q.customer_name,
    'customer_ref', q.customer_po, 'status', r.status,
    'note', replace(replace(replace(r.decision_note, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
    'decided_at', r.decided_at, 'currency', r.currency, 'total_sell', r.total_sell, 'carrier', r.carrier, 'valid_till', r.valid_till,
    'decided_by_email', (select u.email from auth.users u where u.id = r.decided_by),
    'decided_by_name', (select pu.display_name from public.portal_users pu where pu.user_id = r.decided_by),
    'staff_email', (select u.email from auth.users u where u.id = coalesce(r.sent_by, q.sales_executive_id, q.pricing_executive_id))
  )
  from public.quote_responses r join public.quotes q on q.id = r.quote_id
  where r.id = p_response
$$;

revoke all on function public.quote_response_send(uuid), public.quote_response_withdraw(uuid) from public, anon;
grant execute on function public.quote_response_send(uuid), public.quote_response_withdraw(uuid) to authenticated;
revoke all on function public.portal_quote_respond(uuid, text, text) from public, anon;
grant execute on function public.portal_quote_respond(uuid, text, text) to authenticated;
revoke all on function public.portal_quote_decision_payload(uuid) from public, anon, authenticated;
grant execute on function public.portal_quote_decision_payload(uuid) to service_role;

notify pgrst, 'reload schema';

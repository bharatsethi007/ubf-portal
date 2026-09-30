-- Portal quote approval, per quote (applied via Supabase MCP 30 Sep 2026; repo parity, do not re-run).
-- Staff send all options on a quote at once. Customer picks one; the other options become crosswin.
-- Reject rejects every waiting option. Replaces quote_response_send / quote_response_withdraw.

alter table public.quote_responses drop constraint if exists quote_responses_status_check;
alter table public.quote_responses add constraint quote_responses_status_check
  check (status = any (array['draft','published','sent_for_approval','approved','rejected','withdrawn','crosswin']));

create or replace view public.portal_quote_offers as
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
   and r.status in ('sent_for_approval','approved','rejected','withdrawn','crosswin');

drop function if exists public.quote_response_send(uuid);
drop function if exists public.quote_response_withdraw(uuid);

create or replace function public.quote_send_for_approval(p_quote uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare q public.quotes; n int; v_total numeric; v_cur text; v_first uuid; v_till date;
begin
  if not public.is_staff() or not public.has_perm('quotes','edit') then raise exception 'Not allowed'; end if;
  select * into q from public.quotes where id = p_quote for update;
  if q.id is null then raise exception 'Quote not found'; end if;
  if q.customer_account_id is null then raise exception 'Pick a customer account on the quote first'; end if;
  if not exists (select 1 from public.customers where account_id = q.customer_account_id) then raise exception 'Customer account not found'; end if;
  if exists (select 1 from public.quote_responses where quote_id = p_quote and status = 'approved') then
    raise exception 'Customer already approved an option on this quote';
  end if;

  with s as (
    update public.quote_responses
       set status = 'sent_for_approval', sent_to_portal_at = now(), sent_by = auth.uid(),
           decided_at = null, decided_by = null, decision_note = null
     where quote_id = p_quote and status in ('draft','published','withdrawn')
       and coalesce(total_sell, 0) > 0 and (valid_till is null or valid_till >= current_date)
    returning id, total_sell, currency, valid_till, created_at
  )
  select count(*), min(total_sell), min(currency), (array_agg(id order by created_at))[1], min(valid_till)
    into n, v_total, v_cur, v_first, v_till from s;

  if n = 0 then raise exception 'No options to send. Each needs a sell total and a valid till date not in the past'; end if;
  update public.quotes set status = 'sent' where id = p_quote and status in ('open','published');

  insert into public.portal_notifications (account_id, kind, dedupe_key, title, body, facts)
  values (q.customer_account_id, 'quote_ready', 'quote:' || p_quote || ':' || extract(epoch from now())::bigint,
          'Quote ' || q.quote_no || ' is ready' || case when n > 1 then ' (' || n || ' options)' else '' end,
          q.from_port_code || ' to ' || q.to_port_code || ' · ' || case when n > 1 then 'from ' else '' end
            || coalesce(v_cur, 'NZD') || ' ' || to_char(v_total, 'FM999,999,990.00')
            || case when v_till is not null then ' · valid to ' || to_char(v_till, 'DD Mon YYYY') else '' end,
          jsonb_build_object('response_id', v_first, 'quote_id', p_quote, 'ref', q.customer_po))
  on conflict do nothing;

  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-notify-send',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body := '{}'::jsonb, timeout_milliseconds := 60000);
  exception when others then
    raise warning 'quote_send_for_approval notify: %', sqlerrm;
  end;
  return n;
end $$;

create or replace function public.quote_withdraw_approval(p_quote uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if not public.is_staff() or not public.has_perm('quotes','edit') then raise exception 'Not allowed'; end if;
  update public.quote_responses set status = 'withdrawn' where quote_id = p_quote and status = 'sent_for_approval';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Nothing is waiting on the customer'; end if;
  return n;
end $$;

create or replace function public.portal_quote_respond(p_response uuid, p_decision text, p_note text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare acct text := public.my_account_id(); r public.quote_responses; q public.quotes;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Choose approve or reject'; end if;
  select * into r from public.quote_responses where id = p_response;
  select * into q from public.quotes where id = r.quote_id for update;
  if r.id is null or q.customer_account_id is distinct from acct or r.sent_to_portal_at is null then raise exception 'Quote not found'; end if;
  select * into r from public.quote_responses where id = p_response for update;
  if r.status <> 'sent_for_approval' then raise exception 'This quote has already been answered'; end if;

  if p_decision = 'approve' then
    if r.valid_till is not null and r.valid_till < current_date then raise exception 'This option has expired. Ask us to refresh it'; end if;
    update public.quote_responses
       set status = 'approved', decided_at = now(), decided_by = auth.uid(), decision_note = nullif(trim(p_note), '')
     where id = r.id;
    update public.quote_responses set status = 'crosswin', decided_at = now(), decided_by = auth.uid()
     where quote_id = q.id and id <> r.id and status = 'sent_for_approval';
    update public.quotes set status = 'won' where id = q.id;
    perform public.portal_booking_notify_queue(r.id, 'quote_approved');
    return 'approved';
  end if;

  if coalesce(trim(p_note), '') = '' then raise exception 'Tell us why so we can improve it'; end if;
  update public.quote_responses
     set status = 'rejected', decided_at = now(), decided_by = auth.uid(), decision_note = nullif(trim(p_note), '')
   where quote_id = q.id and status = 'sent_for_approval';
  update public.quotes set status = 'lost' where id = q.id and status in ('open','published','sent');
  perform public.portal_booking_notify_queue(r.id, 'quote_rejected');
  return 'rejected';
end $$;

create or replace function public.portal_quote_decision_payload(p_response uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', q.id, 'response_id', r.id, 'response_no', r.response_no, 'quote_no', q.quote_no,
    'mode', q.shipment_mode, 'type', q.shipment_type, 'origin', q.from_port_code, 'destination', q.to_port_code,
    'direction', q.source_meta->>'direction', 'account_id', q.customer_account_id, 'customer_name', q.customer_name,
    'customer_ref', q.customer_po, 'status', r.status,
    'note', replace(replace(replace(r.decision_note, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
    'decided_at', r.decided_at, 'currency', r.currency, 'total_sell', r.total_sell, 'carrier', r.carrier, 'valid_till', r.valid_till,
    'options', (select count(*) from public.quote_responses x where x.quote_id = q.id and x.sent_to_portal_at is not null and x.status in ('approved','rejected','crosswin')),
    'decided_by_email', (select u.email from auth.users u where u.id = r.decided_by),
    'decided_by_name', (select pu.display_name from public.portal_users pu where pu.user_id = r.decided_by),
    'staff_email', (select u.email from auth.users u where u.id = coalesce(r.sent_by, q.sales_executive_id, q.pricing_executive_id))
  )
  from public.quote_responses r join public.quotes q on q.id = r.quote_id
  where r.id = p_response
$$;

revoke all on function public.quote_send_for_approval(uuid), public.quote_withdraw_approval(uuid) from public, anon;
grant execute on function public.quote_send_for_approval(uuid), public.quote_withdraw_approval(uuid) to authenticated;
revoke all on function public.portal_quote_respond(uuid, text, text) from public, anon;
grant execute on function public.portal_quote_respond(uuid, text, text) to authenticated;
revoke all on function public.portal_quote_decision_payload(uuid) from public, anon, authenticated;
grant execute on function public.portal_quote_decision_payload(uuid) to service_role;

notify pgrst, 'reload schema';

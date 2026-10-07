-- Quotes: lost reasons, 30-day expiry + auto-lost, customer reminders with accept/decline links, staff digest.
-- Replaces 20261007_quotes_lost_reason_expiry.sql (never applied).

-- 1. Columns
alter table public.quotes add column if not exists lost_reason text;
alter table public.quotes add column if not exists lost_note text;
alter table public.quotes add column if not exists lost_at timestamptz;
alter table public.quotes add column if not exists expires_at timestamptz;
alter table public.quotes add column if not exists last_reminded_at timestamptz;
create index if not exists quotes_live_expiry_idx on public.quotes (expires_at) where status in ('open','published','sent');

-- 2. Expiry: 30 days from completion (first rate response added).
create or replace function public.quote_set_expiry_on_response()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update quotes set expires_at = now() + interval '30 days'
   where id = new.quote_id and expires_at is null and status in ('open','published','sent');
  return null;
end $$;
drop trigger if exists trg_quote_expiry_on_response on public.quote_responses;
create trigger trg_quote_expiry_on_response after insert on public.quote_responses
  for each row execute function public.quote_set_expiry_on_response();

-- 3. Status bookkeeping
create or replace function public.quote_status_bookkeeping()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'lost' then
      new.lost_at := coalesce(new.lost_at, now());
    else
      new.lost_reason := null; new.lost_note := null; new.lost_at := null;
      if new.status in ('open','published','sent') and new.expires_at is not null and new.expires_at < now() then
        new.expires_at := now() + interval '30 days';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_quote_status_bookkeeping on public.quotes;
create trigger trg_quote_status_bookkeeping before update of status on public.quotes
  for each row execute function public.quote_status_bookkeeping();

-- 4. Auto-lost sweep (hourly)
create or replace function public.expire_quotes()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update quotes set status = 'lost', lost_reason = 'Auto expired', lost_at = now()
   where status in ('open','published','sent') and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_quotes() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'expire-quotes') then perform cron.unschedule('expire-quotes'); end if;
  perform cron.schedule('expire-quotes', '7 * * * *', 'select public.expire_quotes()');
end $$;

-- 5. Backfill
update public.quotes q set expires_at = r.first_resp + interval '30 days'
  from (select quote_id, min(created_at) first_resp from public.quote_responses group by 1) r
 where r.quote_id = q.id and q.status in ('open','published','sent') and q.expires_at is null;

-- 6. copy_quote: copy starts fresh
create or replace function public.copy_quote(p_id uuid)
returns uuid language plpgsql security invoker set search_path to 'public' as $$
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
    'pickup_date', null, 'delivery_date', null,
    'expires_at', null, 'lost_reason', null, 'lost_note', null, 'lost_at', null, 'last_reminded_at', null);
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

-- 7. Reminder log + tokens
create table if not exists public.quote_reminders (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sent_to text not null,
  sent_by uuid,
  mailbox text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  responded_at timestamptz,
  decision text,
  response_id uuid,
  error text
);
create index if not exists quote_reminders_quote_idx on public.quote_reminders (quote_id, sent_at desc);
alter table public.quote_reminders enable row level security;
drop policy if exists quote_reminders_staff_read on public.quote_reminders;
create policy quote_reminders_staff_read on public.quote_reminders for select using (is_staff());

-- 8. Best customer email for a quote: quote contact, then prime ERP contact, then account email.
create or replace function public.quote_contact_email(p_quote uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    nullif(trim(q.contact_email), ''),
    (select c.email from contacts c where c.account_id = q.customer_account_id and nullif(trim(c.email), '') is not null
      order by c.is_prime desc nulls last limit 1),
    nullif(trim(cu.email), ''))
  from quotes q left join customers cu on cu.account_id = q.customer_account_id
  where q.id = p_quote
$$;
revoke all on function public.quote_contact_email(uuid) from public, anon;
grant execute on function public.quote_contact_email(uuid) to authenticated;

-- 9. Reminder candidates for the console popup
drop function if exists public.quote_reminder_candidates(boolean);
create function public.quote_reminder_candidates(p_mine boolean default false)
returns table(id uuid, quote_no text, customer_name text, from_port_code text, to_port_code text,
  owner_id uuid, owner_name text, email text, expires_at timestamptz, priced_at timestamptz,
  last_reminded_at timestamptz, reminders int, options int)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  return query
  select q.id, q.quote_no, q.customer_name, q.from_port_code, q.to_port_code,
    q.created_by, coalesce(nullif(su.full_name, ''), su.email),
    public.quote_contact_email(q.id),
    q.expires_at, q.expires_at - interval '30 days', q.last_reminded_at,
    (select count(*)::int from quote_reminders r where r.quote_id = q.id),
    (select count(*)::int from quote_responses r where r.quote_id = q.id and coalesce(r.total_sell, 0) > 0
       and r.status not in ('rejected','withdrawn'))
  from quotes q left join staff_users su on su.user_id = q.created_by
  where q.status in ('open','published','sent') and q.expires_at is not null
    and (not p_mine or q.created_by = auth.uid())
  order by q.expires_at asc;
end $$;
grant execute on function public.quote_reminder_candidates(boolean) to authenticated;

-- 10. Public view for the customer link (token is the key)
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
        'transit_days', r.transit_time_days, 'total', r.total_sell, 'currency', r.currency,
        'valid_till', r.valid_till, 'status', r.status) order by r.total_sell)
      from quote_responses r where r.quote_id = q.id and coalesce(r.total_sell, 0) > 0
        and r.status not in ('rejected','withdrawn')), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke all on function public.quote_public_view(uuid) from public;
grant execute on function public.quote_public_view(uuid) to anon, authenticated;

-- 11. Public accept / decline
create or replace function public.quote_public_respond(p_token uuid, p_decision text, p_response uuid default null,
  p_reason text default null, p_note text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare rm quote_reminders; q quotes; r quote_responses; v_title text;
begin
  select * into rm from quote_reminders where token = p_token;
  if rm.id is null then raise exception 'This link is not valid'; end if;
  select * into q from quotes where id = rm.quote_id for update;
  if q.status not in ('open','published','sent') then
    raise exception 'This quote is already %', case q.status when 'won' then 'accepted' when 'crosswin' then 'accepted' else 'closed' end;
  end if;
  if q.expires_at is not null and q.expires_at < now() then raise exception 'This quote has expired. Reply to this email and we will refresh it'; end if;

  if p_decision = 'accept' then
    if p_response is null then
      select * into r from quote_responses where quote_id = q.id and coalesce(total_sell, 0) > 0
        and status not in ('rejected','withdrawn') order by total_sell limit 1;
    else
      select * into r from quote_responses where id = p_response and quote_id = q.id;
    end if;
    if r.id is null then raise exception 'Option not found'; end if;
    update quote_responses set status = 'approved', decided_at = now(), decision_note = nullif(trim(p_note), '') where id = r.id;
    update quote_responses set status = 'crosswin', decided_at = now()
      where quote_id = q.id and id <> r.id and status not in ('rejected','withdrawn');
    update quotes set status = 'won' where id = q.id;
    update quote_reminders set responded_at = now(), decision = 'accepted', response_id = r.id where id = rm.id;
    v_title := coalesce(q.customer_name, 'Customer') || ' accepted ' || q.quote_no;
  elsif p_decision = 'decline' then
    if coalesce(trim(p_reason), '') = '' then raise exception 'Please choose a reason'; end if;
    update quote_responses set status = 'rejected', decided_at = now(), decision_note = nullif(trim(p_note), '')
      where quote_id = q.id and status not in ('withdrawn');
    update quotes set status = 'lost', lost_reason = left(trim(p_reason), 120),
      lost_note = left('Declined by customer via email' || coalesce(': ' || nullif(trim(p_note), ''), ''), 1000)
      where id = q.id;
    update quote_reminders set responded_at = now(), decision = 'declined' where id = rm.id;
    v_title := coalesce(q.customer_name, 'Customer') || ' declined ' || q.quote_no;
  else
    raise exception 'Choose accept or decline';
  end if;

  begin
    perform staff_notify(q.created_by, null, null, 'quote_decision', v_title,
      coalesce(p_reason, ''), jsonb_build_object('quote_id', q.id, 'quote_no', q.quote_no, 'via', 'email_link'),
      'customer', 'qr:' || rm.id || ':' || p_decision, '/quotes/' || q.id);
  exception when others then raise warning 'quote_public_respond notify: %', sqlerrm;
  end;
  return case when p_decision = 'accept' then 'accepted' else 'declined' end;
end $$;
revoke all on function public.quote_public_respond(uuid, text, uuid, text, text) from public;
grant execute on function public.quote_public_respond(uuid, text, uuid, text, text) to anon, authenticated;

-- 12. Weekly staff digest (Monday 8:45 NZ; two UTC slots cover daylight saving, fn checks NZ hour)
do $$ begin
  if exists (select 1 from cron.job where jobname = 'quote-staff-digest-a') then perform cron.unschedule('quote-staff-digest-a'); end if;
  if exists (select 1 from cron.job where jobname = 'quote-staff-digest-b') then perform cron.unschedule('quote-staff-digest-b'); end if;
  perform cron.schedule('quote-staff-digest-a', '45 19 * * 0', $c$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/quote-staff-digest',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body := '{}'::jsonb, timeout_milliseconds := 60000) $c$);
  perform cron.schedule('quote-staff-digest-b', '45 20 * * 0', $c$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/quote-staff-digest',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
      body := '{}'::jsonb, timeout_milliseconds := 60000) $c$);
end $$;

notify pgrst, 'reload schema';

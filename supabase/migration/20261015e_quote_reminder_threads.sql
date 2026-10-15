-- Quote reminders: continue an existing email thread, test sends to UBF addresses.
-- 1) Email threads auto-link to a quote when the subject carries the quote number.
-- 2) quote_reminder_threads(): threads a reminder can reply into (quote_email_threads stays for Send quote).
-- 3) quote_reminder_candidates(): adds the linked thread; test sends not counted.
-- 4) Test links (kind = 'test') never change the quote.

-- 1. Auto-link ---------------------------------------------------------------
create or replace function public.quote_no_in_text(p_text text)
returns uuid language sql stable security definer set search_path = public as $$
  select q.id from public.quotes q
   where q.quote_no = upper(substring(coalesce(p_text, '') from '(?i)[A-Z]{3}-Q-(?:\d{4}-)?\d{3,6}'))
   limit 1
$$;

create or replace function public.trg_inbox_conv_quote_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quote_id is null and new.email_mailbox is not null then
    new.quote_id := public.quote_no_in_text(new.subject);
  end if;
  return new;
end $$;

drop trigger if exists trg_inbox_conv_quote_link on public.inbox_conversations;
create trigger trg_inbox_conv_quote_link
  before insert or update of subject on public.inbox_conversations
  for each row execute function public.trg_inbox_conv_quote_link();

update public.inbox_conversations c
   set quote_id = public.quote_no_in_text(c.subject)
 where c.quote_id is null and c.email_mailbox is not null
   and public.quote_no_in_text(c.subject) is not null;

create index if not exists inbox_conversations_quote_idx on public.inbox_conversations (quote_id) where quote_id is not null;

-- 2. Thread picker -----------------------------------------------------------
-- Linked threads first, then threads with the same contact, then same customer. Last 120 days.
create or replace function public.quote_reminder_threads(p_quote uuid, p_email text default null)
returns table(conversation_id uuid, subject text, mailbox text, contact_email text, last_message_at timestamptz, linked boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_acc text; v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  select customer_account_id into v_acc from quotes where id = p_quote;
  v_email := coalesce(v_email, lower(public.quote_contact_email(p_quote)));
  return query
  select c.id, c.subject, c.email_mailbox, c.contact_email, c.last_message_at, (c.quote_id = p_quote)
    from inbox_conversations c
   where c.email_mailbox is not null and c.email_thread_id is not null
     and (c.quote_id = p_quote
          or (c.last_message_at > now() - interval '120 days'
              and ((v_email is not null and lower(c.contact_email) = v_email)
                   or (v_acc is not null and c.account_id = v_acc))))
     and exists (select 1 from inbox_messages m join inbox_email_meta e on e.message_id = m.id
                  where m.conversation_id = c.id and e.graph_id is not null)
   order by (c.quote_id = p_quote) desc nulls last,
            (v_email is not null and lower(c.contact_email) = v_email) desc,
            c.last_message_at desc
   limit 12;
end $$;
grant execute on function public.quote_reminder_threads(uuid, text) to authenticated;

-- 3. Candidates with linked thread -------------------------------------------
drop function if exists public.quote_reminder_candidates(boolean);
create function public.quote_reminder_candidates(p_mine boolean default false)
returns table(id uuid, quote_no text, customer_name text, from_port_code text, to_port_code text, owner_id uuid, owner_name text,
              email text, expires_at timestamptz, priced_at timestamptz, last_reminded_at timestamptz, reminders integer, options integer,
              thread_id uuid, thread_subject text, thread_mailbox text, thread_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  return query
  select q.id, q.quote_no, q.customer_name, q.from_port_code, q.to_port_code,
    q.created_by, coalesce(nullif(su.full_name, ''), su.email),
    public.quote_contact_email(q.id),
    q.expires_at, q.expires_at - interval '30 days', q.last_reminded_at,
    (select count(*)::int from quote_reminders r where r.quote_id = q.id and r.kind <> 'test' and r.error is null),
    (select count(*)::int from quote_responses r where r.quote_id = q.id and coalesce(r.total_sell, 0) > 0
       and r.status not in ('rejected','withdrawn')),
    t.id, t.subject, t.email_mailbox, t.last_message_at
  from quotes q
  left join staff_users su on su.user_id = q.created_by
  left join lateral (
    select c.id, c.subject, c.email_mailbox, c.last_message_at from inbox_conversations c
     where c.quote_id = q.id and c.email_mailbox is not null and c.email_thread_id is not null
     order by c.last_message_at desc limit 1) t on true
  where q.status in ('open','published','sent') and q.expires_at is not null
    and (not p_mine or q.created_by = auth.uid())
  order by q.expires_at asc;
end $$;
grant execute on function public.quote_reminder_candidates(boolean) to authenticated;

-- 4. Test links never change the quote ---------------------------------------
create or replace function public.quote_public_respond(p_token uuid, p_decision text, p_response uuid default null, p_reason text default null, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare rm quote_reminders; q quotes; r quote_responses; v_title text;
begin
  select * into rm from quote_reminders where token = p_token;
  if rm.id is null then raise exception 'This link is not valid'; end if;
  if p_decision not in ('accept','decline') then raise exception 'Choose accept or decline'; end if;
  if rm.kind = 'test' then
    if p_decision = 'decline' and coalesce(trim(p_reason), '') = '' then raise exception 'Please choose a reason'; end if;
    update quote_reminders set responded_at = now(), decision = case when p_decision = 'accept' then 'accepted' else 'declined' end where id = rm.id;
    return case when p_decision = 'accept' then 'accepted' else 'declined' end;
  end if;
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
  else
    if coalesce(trim(p_reason), '') = '' then raise exception 'Please choose a reason'; end if;
    update quote_responses set status = 'rejected', decided_at = now(), decision_note = nullif(trim(p_note), '')
      where quote_id = q.id and status not in ('withdrawn');
    update quotes set status = 'lost', lost_reason = left(trim(p_reason), 120),
      lost_note = left('Declined by customer via email' || coalesce(': ' || nullif(trim(p_note), ''), ''), 1000)
      where id = q.id;
    update quote_reminders set responded_at = now(), decision = 'declined' where id = rm.id;
    v_title := coalesce(q.customer_name, 'Customer') || ' declined ' || q.quote_no;
  end if;

  begin
    perform staff_notify(q.created_by, null, null, 'quote_decision', v_title,
      coalesce(p_reason, ''), jsonb_build_object('quote_id', q.id, 'quote_no', q.quote_no, 'via', 'email_link'),
      'customer', 'qr:' || rm.id || ':' || p_decision, '/quotes/' || q.id);
  exception when others then raise warning 'quote_public_respond notify: %', sqlerrm;
  end;
  return case when p_decision = 'accept' then 'accepted' else 'declined' end;
end $$;

-- Inbox clean-up + auto-link: internal-only threads close themselves, threads we answered close after 2 quiet days
-- (a new inbound reopens them), domain-wide contact rules, bulk actions, and emails auto-link to a job when exactly one matches.

create index if not exists booking_containers_container_no_idx on public.booking_containers (container_no);

insert into public.inbox_email_skip (pattern, note)
select p, n from (values ('%do_not_reply%', 'no-reply senders'), ('%do.not.reply%', 'no-reply senders'),
                         ('%loyalty%', 'marketing'), ('%seareward%', 'marketing')) v(p, n)
where not exists (select 1 from public.inbox_email_skip s where s.pattern = v.p);

-- One job whose container / MBL / HBL / MAWB / job no / customer ref appears in the text. Null when none or ambiguous.
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
           (length(b.mbl_no) >= 8 and position(regexp_replace(upper(b.mbl_no), '[\s\-/]', '', 'g') in tt) > 0)
        or (length(b.hawb) >= 6 and position(regexp_replace(upper(b.hawb), '[\s\-/]', '', 'g') in tt) > 0)
        or (length(b.mawb) >= 8 and position(regexp_replace(upper(b.mawb), '[\s\-/]', '', 'g') in tt) > 0)
        or (length(b.job_no) >= 5 and position(upper(b.job_no) in t) > 0)
        or (length(b.customer_ref) >= 6 and position(upper(b.customer_ref) in t) > 0))
  ) x;
  return case when array_length(ids, 1) = 1 then ids[1] end;
end $$;

-- Domain rules ("everyone at @carrier.com is a carrier") stored as '@domain' rows in inbox_email_contacts.
create or replace function public.inbox_match_email(p_addr text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare a text := lower(btrim(coalesce(p_addr, ''))); d text; r jsonb; v_acc text; n int;
begin
  if a = '' then return null; end if;
  d := split_part(a, '@', 2);
  select jsonb_build_object('account_id', account_id, 'contact_type', contact_type, 'name', name, 'how', 'learned') into r
    from public.inbox_email_contacts where email = a;
  if r is not null then return r; end if;
  select jsonb_build_object('account_id', account_id, 'contact_type', 'customer', 'name', display_name, 'how', 'portal') into r
    from public.portal_users where lower(email) = a and account_id is not null limit 1;
  if r is not null then return r; end if;
  select jsonb_build_object('account_id', account_id, 'contact_type', 'customer',
           'name', nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'how', 'contact') into r
    from public.contacts where lower(email) = a order by is_prime desc nulls last limit 1;
  if r is not null then return r; end if;
  select jsonb_build_object('account_id', account_id, 'contact_type', 'customer', 'name', null, 'how', 'customer') into r
    from public.customers where not coalesce(closed, false) and lower(email) like '%' || a || '%' limit 1;
  if r is not null then return r; end if;
  select jsonb_build_object('account_id', null, 'contact_type', 'agent', 'name', name, 'how', 'agent') into r
    from public.agent_contacts where lower(email) = a limit 1;
  if r is not null then return r; end if;
  if d <> '' then
    select jsonb_build_object('account_id', account_id, 'contact_type', contact_type, 'name', null, 'how', 'domain_rule') into r
      from public.inbox_email_contacts where email = '@' || d;
    if r is not null then return r; end if;
  end if;
  if d <> '' and not public.inbox_public_domain(d) then
    select min(account_id), count(distinct account_id) into v_acc, n from public.contacts where split_part(lower(email), '@', 2) = d;
    if n = 1 then return jsonb_build_object('account_id', v_acc, 'contact_type', 'customer', 'name', null, 'how', 'domain'); end if;
  end if;
  return null;
end $function$;

create or replace function public.inbox_public_domain(p_domain text)
returns boolean language sql immutable as $$
  select lower(coalesce(p_domain, '')) in ('', 'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'xtra.co.nz', 'icloud.com', 'live.com',
    'outlook.co.nz', 'yahoo.co.nz', 'hotmail.co.nz', 'qq.com', '163.com', '126.com', 'ubfreight.com', 'me.com', 'msn.com', 'protonmail.com')
$$;

-- Save the sender's whole company domain as a type (and account). Also applies to open, unlinked conversations from it.
create or replace function public.inbox_link_domain(p_id uuid, p_type text, p_account text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_email text; d text; n int;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_type not in ('customer', 'lead', 'carrier', 'shipper', 'agent') then raise exception 'Bad contact type'; end if;
  select lower(contact_email) into v_email from public.inbox_conversations where id = p_id;
  d := split_part(coalesce(v_email, ''), '@', 2);
  if public.inbox_public_domain(d) then raise exception 'Cannot apply to everyone at @%', coalesce(nullif(d, ''), 'this domain'); end if;
  insert into public.inbox_email_contacts (email, account_id, contact_type, name, updated_at)
  values ('@' || d, p_account, p_type, null, now())
  on conflict (email) do update set account_id = excluded.account_id, contact_type = excluded.contact_type, updated_at = now();
  update public.inbox_conversations c set contact_type = p_type, account_id = coalesce(p_account, c.account_id)
   where c.id <> p_id and c.status <> 'ignored' and c.account_id is null and c.contact_type is null
     and split_part(lower(c.contact_email), '@', 2) = d;
  get diagnostics n = row_count;
  perform public.inbox_event(p_id, 'Everyone at @' || d || ' saved as ' || p_type);
  return jsonb_build_object('domain', d, 'updated', n);
end $$;

-- Bulk actions from the conversation list.
create or replace function public.inbox_bulk(p_ids uuid[], p_action text)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_action = 'close' then
    update public.inbox_conversations set status = 'closed', snoozed_until = null, reply_due_at = null where id = any(p_ids) and status <> 'closed';
  elsif p_action = 'ignore' then
    update public.inbox_conversations set status = 'ignored', snoozed_until = null, reply_due_at = null where id = any(p_ids) and status <> 'ignored';
  elsif p_action = 'open' then
    update public.inbox_conversations set status = 'open', snoozed_until = null where id = any(p_ids) and status <> 'open';
  elsif p_action = 'assign_me' then
    update public.inbox_conversations set assignee_id = auth.uid() where id = any(p_ids);
  elsif p_action = 'unassign' then
    update public.inbox_conversations set assignee_id = null where id = any(p_ids);
  else
    raise exception 'Bad action';
  end if;
  get diagnostics n = row_count;
  insert into public.inbox_messages (conversation_id, channel, kind, sender_kind, sender_user_id, sender_name, body)
  select id, 'internal', 'event', 'staff', auth.uid(), public.inbox_staff_name(auth.uid()),
         case p_action when 'close' then 'Closed' when 'ignore' then 'Ignored' when 'open' then 'Reopened'
                       when 'assign_me' then 'Assigned to ' || coalesce(public.inbox_staff_name(auth.uid()), 'me') else 'Unassigned' end
    from unnest(p_ids) id;
  return n;
end $$;

-- Housekeeping (cron): close email-only threads with no outside party, and threads we answered last that went quiet 2 days.
create or replace function public.inbox_auto_close()
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update public.inbox_conversations
     set status = 'closed', reply_due_at = null
   where status = 'open' and channels = '{email}'
     and (contact_email is null or (last_sender = 'staff' and last_message_at < now() - interval '2 days'));
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.inbox_link_domain(uuid, text, text) to authenticated;
grant execute on function public.inbox_bulk(uuid[], text) to authenticated;
revoke execute on function public.inbox_auto_close() from public, anon, authenticated;
revoke execute on function public.inbox_find_job(text) from public, anon, authenticated;

-- Unified inbox RPCs (staff only). All gated by is_staff(). Applied via MCP 6 Oct 2026.
-- inbox_counts, inbox_list, inbox_get, inbox_mark_read, inbox_note, inbox_assign, inbox_set_status,
-- inbox_reply_portal, inbox_link_contact, inbox_staff_list. WhatsApp replies go through whatsapp-reply edge fn.

create or replace function public.inbox_eff_status(p_status text, p_until timestamptz)
returns text language sql stable as $$
  select case when p_status = 'snoozed' and p_until is not null and p_until <= now() then 'open' else p_status end
$$;

create or replace function public.inbox_event(p_conv uuid, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.inbox_messages (conversation_id, channel, kind, sender_kind, sender_user_id, sender_name, body)
  values (p_conv, 'internal', 'event', 'staff', auth.uid(), public.inbox_staff_name(auth.uid()), p_body)
$$;

create or replace function public.inbox_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  with c as (
    select c.*, public.inbox_eff_status(c.status, c.snoozed_until) eff, wc.contact_type
      from public.inbox_conversations c left join public.whatsapp_contacts wc on wc.id = c.wa_contact_id
  ), o as (select * from c where eff = 'open')
  select jsonb_build_object(
    'mine', (select count(*) from o where assignee_id = auth.uid()),
    'unassigned', (select count(*) from o where assignee_id is null),
    'unknown', (select count(*) from o where account_id is null and contact_type is null),
    'all', (select count(*) from o),
    'snoozed', (select count(*) from c where eff = 'snoozed'),
    'overdue', (select count(*) from o where reply_due_at < now()),
    'awaiting', (select count(*) from o where reply_due_at is not null),
    'channels', (select coalesce(jsonb_object_agg(last_channel, n), '{}') from (select last_channel, count(*) n from o where last_channel is not null group by 1) x),
    'teams', (select coalesce(jsonb_object_agg(team, n), '{}') from (select team, count(*) n from o where team is not null group by 1) x)
  ) into r;
  return r;
end $$;

create or replace function public.inbox_list(p_view text default 'all', p_channel text default null, p_team text default null,
                                             p_search text default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_where text := 'true'; v_sql text; r jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  v_where := case coalesce(p_view, 'all')
    when 'mine' then 'eff = ''open'' and assignee_id = auth.uid()'
    when 'unassigned' then 'eff = ''open'' and assignee_id is null'
    when 'unknown' then 'eff = ''open'' and account_id is null and contact_type is null'
    when 'snoozed' then 'eff = ''snoozed'''
    when 'closed' then 'eff = ''closed'''
    else 'eff = ''open''' end;
  if p_channel is not null then v_where := v_where || ' and exists (select 1 from inbox_messages m where m.conversation_id = x.id and m.channel = $1)'; end if;
  if p_team is not null then v_where := v_where || ' and team = $2'; end if;
  if nullif(btrim(coalesce(p_search, '')), '') is not null then
    v_where := v_where || ' and (subject ilike $3 or last_preview ilike $3 or who ilike $3 or account_name ilike $3 or coalesce(wa_id, '''') ilike $3 or coalesce(booking_ref, '''') ilike $3
      or exists (select 1 from inbox_messages m where m.conversation_id = x.id and m.body ilike $3))';
  end if;
  v_sql := format($q$
    with x as (
      select c.id, c.subject, c.account_id, c.team, c.assignee_id, c.last_message_at, c.last_preview, c.last_channel,
             c.last_sender, c.reply_due_at, c.wa_contact_id,
             public.inbox_eff_status(c.status, c.snoozed_until) eff,
             cu.name account_name, wc.wa_id, wc.contact_type, b.booking_ref,
             coalesce(wc.display_name,
                      (select m.sender_name from inbox_messages m where m.conversation_id = c.id and m.sender_kind = 'customer' order by m.created_at desc limit 1),
                      cu.name, 'Unknown') who,
             public.inbox_staff_name(c.assignee_id) assignee_name
        from inbox_conversations c
        left join customers cu on cu.account_id = c.account_id
        left join whatsapp_contacts wc on wc.id = c.wa_contact_id
        left join bookings b on b.id = c.booking_id
    )
    select coalesce(jsonb_agg(to_jsonb(y) order by y.sort_due nulls last, y.last_message_at desc), '[]')
      from (
        select x.*, case when x.reply_due_at is not null then x.reply_due_at end sort_due,
               (select count(*) from inbox_messages m where m.conversation_id = x.id and m.direction = 'in'
                  and m.created_at > coalesce((select rd.read_at from inbox_reads rd where rd.conversation_id = x.id and rd.user_id = auth.uid()), '-infinity')) unread,
               (select coalesce(jsonb_agg(distinct m.channel), '[]') from inbox_messages m where m.conversation_id = x.id and m.kind = 'message') channels
          from x where %s
         order by x.reply_due_at nulls last, x.last_message_at desc
         limit %s
      ) y
  $q$, v_where, greatest(1, least(coalesce(p_limit, 100), 300)));
  execute v_sql into r using p_channel, p_team, '%' || btrim(coalesce(p_search, '')) || '%';
  return r;
end $$;

create or replace function public.inbox_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.inbox_conversations; wc public.whatsapp_contacts; v_last_in timestamptz; r jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into c from public.inbox_conversations where id = p_id;
  if not found then raise exception 'Conversation not found'; end if;
  select * into wc from public.whatsapp_contacts where id = c.wa_contact_id;
  if wc.id is null and c.account_id is not null then
    select * into wc from public.whatsapp_contacts where account_id = c.account_id order by last_seen_at desc nulls last limit 1;
  end if;
  if wc.id is not null then
    select max(created_at) into v_last_in from public.whatsapp_messages where contact_id = wc.id and direction = 'inbound';
  end if;
  select jsonb_build_object(
    'conversation', to_jsonb(c) || jsonb_build_object(
        'eff_status', public.inbox_eff_status(c.status, c.snoozed_until),
        'assignee_name', public.inbox_staff_name(c.assignee_id),
        'booking_ref', (select booking_ref from public.bookings where id = c.booking_id)),
    'account', (select jsonb_build_object('account_id', cu.account_id, 'name', cu.name,
                  'portal_users', (select count(*) from public.portal_users pu where pu.account_id = cu.account_id))
                  from public.customers cu where cu.account_id = c.account_id),
    'contact', case when wc.id is null then null else jsonb_build_object(
        'id', wc.id, 'wa_id', wc.wa_id, 'display_name', wc.display_name, 'contact_type', wc.contact_type,
        'company', wc.company, 'verified', wc.verified_at is not null, 'opted_in', wc.opted_in,
        'last_inbound_at', v_last_in, 'window_ends_at', v_last_in + interval '24 hours') end,
    'messages', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'channel', m.channel, 'kind', m.kind, 'direction', m.direction, 'sender_kind', m.sender_kind,
        'sender_name', m.sender_name, 'body', m.body, 'msg_type', m.msg_type, 'media_path', m.media_path,
        'status', m.status, 'created_at', m.created_at) order by m.created_at, m.id), '[]')
        from public.inbox_messages m where m.conversation_id = c.id),
    'shipments', (select coalesce(jsonb_agg(s order by s.focus desc, s.priority desc nulls last), '[]') from (
        select b.id, b.booking_ref, b.origin, b.destination, f.stage, f.next_action, f.action_due, f.urgency, f.priority,
               f.last_free_day, f.eta, (b.id = c.booking_id) focus
          from public.bookings b join public.v_booking_flow f on f.booking_id = b.id
         where c.account_id is not null
           and (b.account_id = c.account_id or b.importer_account_id = c.account_id or b.consignee_account_id = c.account_id)
           and (f.stage not in ('closed', 'declined') or b.id = c.booking_id)
         order by (b.id = c.booking_id) desc, f.priority desc nulls last limit 6) s)
  ) into r;
  return r;
end $$;

create or replace function public.inbox_mark_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  insert into public.inbox_reads (conversation_id, user_id, read_at) values (p_id, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set read_at = excluded.read_at;
end $$;

create or replace function public.inbox_note(p_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_body text := btrim(coalesce(p_body, ''));
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if v_body = '' then raise exception 'Write a note first'; end if;
  insert into public.inbox_messages (conversation_id, channel, kind, sender_kind, sender_user_id, sender_name, body)
  values (p_id, 'internal', 'note', 'staff', auth.uid(), public.inbox_staff_name(auth.uid()), left(v_body, 4000));
end $$;

create or replace function public.inbox_assign(p_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  update public.inbox_conversations set assignee_id = p_user where id = p_id;
  perform public.inbox_event(p_id, case when p_user is null then 'Unassigned'
                                        else 'Assigned to ' || coalesce(public.inbox_staff_name(p_user), 'staff') end);
end $$;

create or replace function public.inbox_set_status(p_id uuid, p_status text, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_thread uuid;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_status not in ('open', 'snoozed', 'closed') then raise exception 'Bad status'; end if;
  if p_status = 'snoozed' and p_until is null then raise exception 'Pick a snooze time'; end if;
  update public.inbox_conversations
     set status = p_status, snoozed_until = case when p_status = 'snoozed' then p_until end,
         reply_due_at = case when p_status = 'closed' then null else reply_due_at end
   where id = p_id returning portal_thread_id into v_thread;
  if v_thread is not null then
    update public.portal_threads set status = case when p_status = 'closed' then 'closed' else 'open' end where id = v_thread;
  end if;
  perform public.inbox_event(p_id, case p_status when 'closed' then 'Closed' when 'open' then 'Reopened'
                                     else 'Snoozed until ' || to_char(p_until at time zone 'Pacific/Auckland', 'DD Mon HH24:MI') end);
end $$;

create or replace function public.inbox_reply_portal(p_id uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.inbox_conversations; v_thread uuid;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into c from public.inbox_conversations where id = p_id;
  if c.account_id is null then raise exception 'Link this contact to a customer account first'; end if;
  v_thread := c.portal_thread_id;
  if v_thread is null then
    insert into public.portal_threads (account_id, booking_id, job_unique, module, subject, created_by)
    values (c.account_id, c.booking_id, c.job_unique, c.team, coalesce(nullif(c.subject, 'WhatsApp'), 'Message from UB Freight'), auth.uid())
    returning id into v_thread;
    update public.inbox_conversations set portal_thread_id = v_thread where id = p_id;
  end if;
  update public.portal_threads set status = 'open' where id = v_thread and status <> 'open';
  perform public.staff_message_send(v_thread, p_body);
end $$;

create or replace function public.inbox_link_contact(p_id uuid, p_type text, p_account text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_wc uuid; v_name text;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_type not in ('customer', 'lead', 'carrier', 'shipper', 'agent', 'spam') then raise exception 'Bad contact type'; end if;
  if p_type = 'customer' and p_account is null then raise exception 'Pick a customer account'; end if;
  select wa_contact_id into v_wc from public.inbox_conversations where id = p_id;
  if v_wc is not null then
    update public.whatsapp_contacts set contact_type = p_type, account_id = coalesce(p_account, account_id) where id = v_wc;
  end if;
  if p_account is not null then
    update public.inbox_conversations set account_id = p_account where id = p_id;
    select name into v_name from public.customers where account_id = p_account;
  end if;
  perform public.inbox_event(p_id, 'Marked as ' || p_type || coalesce(' · ' || v_name, ''));
  if p_type = 'spam' then perform public.inbox_set_status(p_id, 'closed'); end if;
end $$;

create or replace function public.inbox_staff_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_staff() then coalesce(jsonb_agg(jsonb_build_object(
           'user_id', user_id, 'name', public.inbox_staff_name(user_id), 'initials', initials) order by full_name), '[]') end
    from public.staff_users where coalesce(is_active, true)
$$;

grant execute on function public.inbox_counts(), public.inbox_list(text, text, text, text, int), public.inbox_get(uuid),
  public.inbox_mark_read(uuid), public.inbox_note(uuid, text), public.inbox_assign(uuid, uuid),
  public.inbox_set_status(uuid, text, timestamptz), public.inbox_reply_portal(uuid, text),
  public.inbox_link_contact(uuid, text, text), public.inbox_staff_list() to authenticated;

notify pgrst, 'reload schema';

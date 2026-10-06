-- Inbox: ignore conversations / senders, and find + link portal jobs (bookings) from a conversation.

alter table public.inbox_conversations drop constraint if exists inbox_conversations_status_check;
alter table public.inbox_conversations add constraint inbox_conversations_status_check
  check (status = any (array['open', 'snoozed', 'closed', 'ignored']));

-- New mail in an ignored thread stays ignored (no reopen, no reply timer).
create or replace function public.inbox_bump(p_conv uuid, p_at timestamptz, p_channel text, p_sender text, p_preview text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_in boolean := p_sender in ('customer', 'contact');
begin
  update public.inbox_conversations c set
    last_message_at = greatest(c.last_message_at, p_at),
    last_channel = p_channel,
    last_sender = p_sender,
    last_preview = left(regexp_replace(coalesce(p_preview, ''), '\s+', ' ', 'g'), 200),
    last_inbound_at = case when v_in then p_at else c.last_inbound_at end,
    reply_due_at = case when c.status = 'ignored' then null
                        when v_in then coalesce(c.reply_due_at, p_at + interval '1 hour')
                        when p_sender = 'staff' then null else c.reply_due_at end,
    first_reply_at = case when p_sender = 'staff' then coalesce(c.first_reply_at, p_at) else c.first_reply_at end,
    status = case when c.status = 'ignored' then 'ignored' when v_in then 'open' else c.status end,
    snoozed_until = case when v_in then null else c.snoozed_until end
  where c.id = p_conv;
end $$;

-- Reopen also lifts a staff-added sender block.
create or replace function public.inbox_set_status(p_id uuid, p_status text, p_until timestamptz default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_thread uuid; v_email text;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_status not in ('open', 'snoozed', 'closed') then raise exception 'Bad status'; end if;
  if p_status = 'snoozed' and p_until is null then raise exception 'Pick a snooze time'; end if;
  update public.inbox_conversations
     set status = p_status, snoozed_until = case when p_status = 'snoozed' then p_until end,
         reply_due_at = case when p_status = 'closed' then null else reply_due_at end
   where id = p_id returning portal_thread_id, lower(contact_email) into v_thread, v_email;
  if v_thread is not null then
    update public.portal_threads set status = case when p_status = 'closed' then 'closed' else 'open' end where id = v_thread;
  end if;
  if p_status = 'open' and v_email is not null then
    delete from public.inbox_email_skip where pattern = v_email and note = 'ignored by staff';
  end if;
  perform public.inbox_event(p_id, case p_status when 'closed' then 'Closed' when 'open' then 'Reopened'
                                     else 'Snoozed until ' || to_char(p_until at time zone 'Pacific/Auckland', 'DD Mon HH24:MI') end);
end $$;

create or replace function public.inbox_ignore(p_id uuid, p_sender boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_email text; v_blocked boolean := false;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  update public.inbox_conversations set status = 'ignored', snoozed_until = null, reply_due_at = null
   where id = p_id returning lower(contact_email) into v_email;
  if p_sender then
    if v_email is null or v_email not like '%@%' then raise exception 'No sender email on this conversation'; end if;
    if v_email like '%@ubfreight.com' then raise exception 'Cannot block a UB Freight address'; end if;
    insert into public.inbox_email_skip (pattern, note)
    select v_email, 'ignored by staff' where not exists (select 1 from public.inbox_email_skip where pattern = v_email);
    v_blocked := true;
  end if;
  perform public.inbox_event(p_id, case when v_blocked then 'Ignored. Future emails from ' || v_email || ' are skipped' else 'Ignored' end);
  return jsonb_build_object('ok', true, 'blocked', case when v_blocked then v_email end);
end $$;

-- Jobs for a conversation: typed search, or (empty query) the linked job plus any job whose
-- ref / job no / MBL / HAWB / MAWB / customer ref / container number appears in the thread.
create or replace function public.inbox_job_search(p_conv uuid, p_q text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), ''); v_text text := ''; v_linked uuid; r jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select booking_id into v_linked from public.inbox_conversations where id = p_conv;
  if v_q is null then
    select upper(coalesce(max(c.subject), '') || ' ' || coalesce(string_agg(left(coalesce(m.body, ''), 6000), ' '), ''))
      into v_text
      from public.inbox_conversations c
      left join public.inbox_messages m on m.conversation_id = c.id and m.kind = 'message'
     where c.id = p_conv;
    v_text := coalesce(v_text, '');
  end if;
  with hit as (
    select b.id, case when b.id = v_linked then 0 else 1 end rnk, b.created_at
      from public.bookings b
     where case when v_q is not null then
             b.booking_ref ilike '%' || v_q || '%' or b.job_no ilike '%' || v_q || '%' or b.customer_ref ilike '%' || v_q || '%'
             or b.mbl_no ilike '%' || v_q || '%' or b.hawb ilike '%' || v_q || '%' or b.mawb ilike '%' || v_q || '%'
             or b.importer_name ilike '%' || v_q || '%' or b.consignee_name ilike '%' || v_q || '%'
             or exists (select 1 from public.customers cu where cu.account_id = coalesce(b.account_id, b.importer_account_id) and cu.name ilike '%' || v_q || '%')
             or exists (select 1 from public.booking_containers bc where bc.booking_id = b.id and bc.container_no ilike '%' || v_q || '%')
           else
             b.id = v_linked
             or (length(b.booking_ref) >= 6 and position(upper(b.booking_ref) in v_text) > 0)
             or (length(b.job_no) >= 5 and position(upper(b.job_no) in v_text) > 0)
             or (length(b.mbl_no) >= 8 and position(upper(b.mbl_no) in v_text) > 0)
             or (length(b.hawb) >= 6 and position(upper(b.hawb) in v_text) > 0)
             or (length(b.mawb) >= 8 and position(upper(b.mawb) in v_text) > 0)
             or (length(b.customer_ref) >= 6 and position(upper(b.customer_ref) in v_text) > 0)
             or exists (select 1 from public.booking_containers bc where bc.booking_id = b.id
                          and length(bc.container_no) = 11 and position(upper(bc.container_no) in v_text) > 0)
           end
     order by 2, 3 desc
     limit 12
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'booking_ref', b.booking_ref, 'job_no', b.job_no, 'module', b.module, 'status', b.status,
           'customer', coalesce(cu.name, b.importer_name, b.consignee_name), 'customer_ref', b.customer_ref,
           'mbl_no', b.mbl_no, 'hawb', b.hawb, 'eta', b.eta, 'etd', b.etd, 'linked', b.id = v_linked,
           'containers', (select string_agg(bc.container_no, ', ' order by bc.sort_order) from public.booking_containers bc where bc.booking_id = b.id)
         ) order by h.rnk, h.created_at desc), '[]')
    into r
    from hit h join public.bookings b on b.id = h.id
    left join public.customers cu on cu.account_id = coalesce(b.account_id, b.importer_account_id);
  return r;
end $$;

create or replace function public.inbox_link_job(p_id uuid, p_booking uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_ref text; v_mod text;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_booking is not null then
    select booking_ref, module into v_ref, v_mod from public.bookings where id = p_booking;
    if v_ref is null then raise exception 'Job not found'; end if;
  end if;
  update public.inbox_conversations set booking_id = p_booking, team = coalesce(team, v_mod) where id = p_id;
  perform public.inbox_event(p_id, case when p_booking is null then 'Unlinked from job' else 'Linked to job ' || v_ref end);
end $$;

grant execute on function public.inbox_ignore(uuid, boolean) to authenticated;
grant execute on function public.inbox_job_search(uuid, text) to authenticated;
grant execute on function public.inbox_link_job(uuid, uuid) to authenticated;

-- Adds the "ignored" view so staff can find and restore ignored conversations.
create or replace function public.inbox_list(p_view text default 'all', p_channel text default null, p_team text default null,
                                             p_search text default null, p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v_where text; v_sql text; r jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  v_where := case coalesce(p_view, 'all')
    when 'mine' then 'eff = ''open'' and assignee_id = auth.uid()'
    when 'unassigned' then 'eff = ''open'' and assignee_id is null'
    when 'unknown' then 'eff = ''open'' and account_id is null and contact_type is null'
    when 'snoozed' then 'eff = ''snoozed'''
    when 'closed' then 'eff = ''closed'''
    when 'ignored' then 'eff = ''ignored'''
    else 'eff = ''open''' end;
  if p_channel is not null then v_where := v_where || ' and $1 = any(channels)'; end if;
  if p_team is not null then v_where := v_where || ' and team = $2'; end if;
  if nullif(btrim(coalesce(p_search, '')), '') is not null then
    v_where := v_where || ' and (subject ilike $3 or last_preview ilike $3 or who ilike $3 or account_name ilike $3
      or coalesce(wa_id, '''') ilike $3 or coalesce(contact_email, '''') ilike $3 or coalesce(booking_ref, '''') ilike $3
      or exists (select 1 from inbox_messages m where m.conversation_id = x.id and m.body ilike $3))';
  end if;
  v_sql := format($q$
    with x as (
      select c.id, c.subject, c.account_id, c.team, c.assignee_id, c.last_message_at, c.last_preview, c.last_channel,
             c.last_sender, c.reply_due_at, c.wa_contact_id, c.channels, c.contact_email,
             public.inbox_eff_status(c.status, c.snoozed_until) eff,
             cu.name account_name, wc.wa_id, coalesce(wc.contact_type, c.contact_type) contact_type, b.booking_ref,
             coalesce(c.who, wc.display_name, c.contact_name, cu.name, c.contact_email, 'Unknown') who,
             public.inbox_staff_name(c.assignee_id) assignee_name
        from inbox_conversations c
        left join customers cu on cu.account_id = c.account_id
        left join whatsapp_contacts wc on wc.id = c.wa_contact_id
        left join bookings b on b.id = c.booking_id
    )
    select coalesce(jsonb_agg(to_jsonb(y) order by y.reply_due_at nulls last, y.last_message_at desc), '[]')
      from (
        select x.*,
               (select count(*) from inbox_messages m where m.conversation_id = x.id and m.direction = 'in'
                  and m.created_at > coalesce((select rd.read_at from inbox_reads rd where rd.conversation_id = x.id and rd.user_id = auth.uid()), '-infinity')) unread
          from x where %s
         order by x.reply_due_at nulls last, x.last_message_at desc
         limit %s
      ) y
  $q$, v_where, greatest(1, least(coalesce(p_limit, 100), 500)));
  execute v_sql into r using p_channel, p_team, '%' || btrim(coalesce(p_search, '')) || '%';
  return r;
end $function$;

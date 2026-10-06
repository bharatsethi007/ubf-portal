-- Inbox perf + names fix. Applied via MCP 6 Oct 2026. Repo parity file, do not re-run.
-- 1. inbox_get shipments: account booking ids first, then v_booking_flow by id via EXECUTE, cheap columns only
--    (urgency/priority cost ~300ms; old join hit 8s timeouts under load). Now ~45ms.
-- 2. Portal sender names use portal_users.display_name instead of the login email.
-- 3. inbox_get returns contact_linked so the UI titles portal threads by their own sender.

create or replace function public.inbox_ingest_portal(m public.portal_messages)
returns void language plpgsql security definer set search_path = public as $$
declare v_conv uuid := public.inbox_conv_for_portal(m.thread_id); v_name text := m.sender_name;
begin
  if m.sender_kind = 'customer' and m.sender_user_id is not null then
    select coalesce(nullif(btrim(display_name), ''), v_name) into v_name from public.portal_users where user_id = m.sender_user_id;
  end if;
  insert into public.inbox_messages (conversation_id, channel, kind, direction, sender_kind, sender_user_id, sender_name, body, source, source_id, created_at)
  values (v_conv, 'portal', 'message', case when m.sender_kind = 'staff' then 'out' else 'in' end,
          m.sender_kind, m.sender_user_id, coalesce(v_name, m.sender_name), m.body, 'portal', m.id::text, m.created_at)
  on conflict do nothing;
  perform public.inbox_bump(v_conv, m.created_at, 'portal', m.sender_kind, m.body);
end $$;

update public.inbox_messages im set sender_name = pu.display_name
  from public.portal_messages pm join public.portal_users pu on pu.user_id = pm.sender_user_id
 where im.source = 'portal' and im.source_id = pm.id::text and im.sender_kind = 'customer'
   and nullif(btrim(pu.display_name), '') is not null and im.sender_name is distinct from pu.display_name;

create or replace function public.inbox_get(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.inbox_conversations; wc public.whatsapp_contacts; v_last_in timestamptz; v_ids uuid[]; v_ships jsonb; r jsonb;
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
  if c.account_id is not null then
    select array_agg(id) into v_ids from (
      select b.id from public.bookings b
       where b.account_id = c.account_id or b.importer_account_id = c.account_id or b.consignee_account_id = c.account_id
       order by b.created_at desc limit 40) z;
  end if;
  if c.booking_id is not null then v_ids := array_append(coalesce(v_ids, '{}'), c.booking_id); end if;

  v_ships := '[]';
  if v_ids is not null then
    -- Only cheap v_booking_flow columns (urgency/priority cost ~300ms). Fresh plan via execute.
    execute $q$
      select coalesce(jsonb_agg(s order by s.focus desc, s.action_due nulls last), '[]') from (
        select b.id, b.booking_ref, b.origin, b.destination, f.stage, f.next_action, f.action_due,
               f.last_free_day, f.eta, (b.id is not distinct from $2) focus
          from public.v_booking_flow f join public.bookings b on b.id = f.booking_id
         where f.booking_id = any($1) and (f.stage not in ('closed', 'declined') or b.id is not distinct from $2)
         order by (b.id is not distinct from $2) desc, f.action_due nulls last limit 6) s
    $q$ into v_ships using v_ids, c.booking_id;
  end if;

  select jsonb_build_object(
    'conversation', to_jsonb(c) || jsonb_build_object(
        'eff_status', public.inbox_eff_status(c.status, c.snoozed_until),
        'assignee_name', public.inbox_staff_name(c.assignee_id),
        'booking_ref', (select booking_ref from public.bookings where id = c.booking_id),
        'contact_linked', c.wa_contact_id is not null),
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
    'shipments', v_ships
  ) into r;
  return r;
end $$;

notify pgrst, 'reload schema';

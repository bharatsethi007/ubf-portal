-- Inbox email UI support + schedule. Applied via MCP 6 Oct 2026. Idempotent.
-- inbox_get: email block + per-message email meta and attachments. inbox_link_contact: learns email senders.
-- pg_cron email-inbox-sync every 2 min (no-op while no mailbox is enabled).

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
    'email', case when c.email_mailbox is null then null else jsonb_build_object(
        'mailbox', c.email_mailbox, 'contact_email', c.contact_email, 'contact_name', c.contact_name) end,
    'messages', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'channel', m.channel, 'kind', m.kind, 'direction', m.direction, 'sender_kind', m.sender_kind,
        'sender_name', m.sender_name, 'body', m.body, 'msg_type', m.msg_type, 'media_path', m.media_path,
        'status', m.status, 'created_at', m.created_at,
        'email', (select jsonb_build_object('subject', em.subject, 'from', em.from_address, 'to', em.to_list, 'cc', em.cc_list,
                    'web_link', em.web_link,
                    'attachments', (select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'size', a.size, 's3_key', a.s3_key, 'content_type', a.content_type) order by a.id), '[]')
                                      from public.inbox_attachments a where a.message_id = m.id))
                    from public.inbox_email_meta em where em.message_id = m.id)
        ) order by m.created_at, m.id), '[]')
        from public.inbox_messages m where m.conversation_id = c.id),
    'shipments', v_ships
  ) into r;
  return r;
end $$;

create or replace function public.inbox_link_contact(p_id uuid, p_type text, p_account text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_wc uuid; v_email text; v_cname text; v_name text;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_type not in ('customer', 'lead', 'carrier', 'shipper', 'agent', 'spam') then raise exception 'Bad contact type'; end if;
  if p_type = 'customer' and p_account is null then raise exception 'Pick a customer account'; end if;
  select wa_contact_id, contact_email, contact_name into v_wc, v_email, v_cname from public.inbox_conversations where id = p_id;
  if v_wc is not null then
    update public.whatsapp_contacts set contact_type = p_type, account_id = coalesce(p_account, account_id) where id = v_wc;
  end if;
  if v_email is not null then
    insert into public.inbox_email_contacts (email, account_id, contact_type, name, updated_at)
    values (lower(v_email), p_account, p_type, v_cname, now())
    on conflict (email) do update set account_id = coalesce(excluded.account_id, inbox_email_contacts.account_id),
      contact_type = excluded.contact_type, updated_at = now();
  end if;
  update public.inbox_conversations set contact_type = p_type, account_id = coalesce(p_account, account_id) where id = p_id;
  if p_account is not null then select name into v_name from public.customers where account_id = p_account; end if;
  perform public.inbox_event(p_id, 'Marked as ' || p_type || coalesce(' · ' || v_name, ''));
  if p_type = 'spam' then perform public.inbox_set_status(p_id, 'closed'); end if;
end $$;

select cron.schedule('email-inbox-sync', '*/2 * * * *', $c$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/email-inbox-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$c$);

notify pgrst, 'reload schema';

-- inbox_ingest_email: internal-only threads start closed; unlinked threads auto-link to a job when exactly one matches.
create or replace function public.inbox_ingest_email(p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_imid text := p->>'internet_message_id'; v_mb text := lower(p->>'mailbox'); v_thread text := p->>'thread_id';
  v_from text := lower(p#>>'{from,address}'); v_fname text := nullif(btrim(coalesce(p#>>'{from,name}', '')), '');
  v_out boolean := coalesce((p->>'outbound')::boolean, false); v_at timestamptz := (p->>'at')::timestamptz;
  v_subj text := coalesce(p->>'subject', ''); v_body text := coalesce(nullif(btrim(p->>'body'), ''), left(coalesce(p->>'full_text', ''), 4000));
  v_conv uuid; v_mid bigint; m jsonb; v_other text; v_oname text; v_ref text; v_bk uuid; v_mod text; v_bacc text; v_team text; v_kind text;
  v_cur_bk uuid; v_auto uuid; v_auto_ref text;
begin
  if v_imid is null then raise exception 'internet_message_id required'; end if;
  v_out := v_out or v_from = v_mb or coalesce(v_from, '') like '%@ubfreight.com';
  if exists (select 1 from public.inbox_messages where source = 'email' and source_id = v_imid) then
    return jsonb_build_object('status', 'duplicate');
  end if;
  if not v_out and (exists (select 1 from public.inbox_email_skip s where v_from ilike s.pattern)
       or v_subj ~* '^\s*(automatic reply|auto[- ]?reply|out of office|undeliverable|delivery status notification|read:|accepted:|declined:)') then
    return jsonb_build_object('status', 'skipped');
  end if;

  if v_out then
    select lower(x->>'address'), nullif(x->>'name', '') into v_other, v_oname
      from jsonb_array_elements(coalesce(p->'to', '[]') || coalesce(p->'cc', '[]')) x
     where coalesce(x->>'address', '') <> '' and lower(x->>'address') not like '%@ubfreight.com' limit 1;
  else
    v_other := v_from; v_oname := v_fname;
  end if;

  select id into v_conv from public.inbox_conversations
   where email_mailbox = v_mb and email_thread_id = v_thread order by last_message_at desc limit 1;
  if v_conv is null then
    m := public.inbox_match_email(v_other);
    v_ref := upper(substring(v_subj || ' ' || left(v_body, 4000) from '(?i)UBF-[A-Z]{2}-\d{2}-\d{3,4}'));
    if v_ref is not null then
      select id, module, coalesce(account_id, importer_account_id, consignee_account_id) into v_bk, v_mod, v_bacc
        from public.bookings where booking_ref ilike v_ref limit 1;
    end if;
    select default_team into v_team from public.inbox_email_sync where mailbox = v_mb;
    insert into public.inbox_conversations (account_id, booking_id, subject, team, email_mailbox, email_thread_id,
                                            contact_email, contact_name, contact_type, status, created_at, last_message_at)
    values (coalesce(m->>'account_id', v_bacc), v_bk,
            nullif(btrim(regexp_replace(v_subj, '^\s*((re|fw|fwd)\s*:\s*)+', '', 'i')), ''),
            coalesce(v_mod, v_team), v_mb, v_thread, v_other, coalesce(m->>'name', v_oname),
            case when m->>'account_id' is not null or v_bacc is not null then 'customer' else m->>'contact_type' end,
            case when v_other is null then 'closed' else 'open' end, v_at, v_at)
    returning id into v_conv;
  end if;

  v_kind := case when v_out then 'staff'
                 when (select account_id from public.inbox_conversations where id = v_conv) is not null then 'customer'
                 else 'contact' end;
  insert into public.inbox_messages (conversation_id, channel, kind, direction, sender_kind, sender_user_id, sender_name, body, source, source_id, created_at)
  values (v_conv, 'email', 'message', case when v_out then 'out' else 'in' end, v_kind,
          nullif(p->>'sender_user_id', '')::uuid, coalesce(v_fname, v_from), v_body, 'email', v_imid, v_at)
  returning id into v_mid;
  insert into public.inbox_email_meta (message_id, mailbox, graph_id, internet_message_id, thread_id, subject, from_address, from_name,
                                       to_list, cc_list, full_text, web_link)
  values (v_mid, v_mb, p->>'graph_id', v_imid, v_thread, v_subj, v_from, v_fname,
          coalesce(p->'to', '[]'), coalesce(p->'cc', '[]'), p->>'full_text', p->>'web_link');
  insert into public.inbox_attachments (message_id, name, content_type, size, s3_key)
  select v_mid, a->>'name', a->>'content_type', nullif(a->>'size', '')::int, a->>'s3_key'
    from jsonb_array_elements(coalesce(p->'attachments', '[]')) a where coalesce(a->>'s3_key', '') <> '';
  perform public.inbox_bump(v_conv, v_at, 'email', v_kind, coalesce(nullif(v_body, ''), v_subj));

  select booking_id into v_cur_bk from public.inbox_conversations where id = v_conv;
  if v_cur_bk is null then
    v_auto := public.inbox_find_job(v_subj || ' ' || left(coalesce(p->>'full_text', v_body), 12000));
    if v_auto is not null then
      select booking_ref, module into v_auto_ref, v_mod from public.bookings where id = v_auto;
      update public.inbox_conversations set booking_id = v_auto, team = coalesce(team, v_mod) where id = v_conv;
      insert into public.inbox_messages (conversation_id, channel, kind, sender_kind, sender_name, body, created_at)
      values (v_conv, 'internal', 'event', 'system', 'Auto', 'Linked to job ' || v_auto_ref || ' (matched in email)', v_at + interval '1 second');
    end if;
  end if;
  return jsonb_build_object('status', 'inserted', 'message_id', v_mid, 'conversation_id', v_conv);
end $function$;

revoke execute on function public.inbox_ingest_email(jsonb) from public, anon, authenticated;

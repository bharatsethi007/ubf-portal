-- Email channel for the unified inbox (shared mailboxes via Microsoft Graph). Applied via MCP 6 Oct 2026. Idempotent.
-- email-inbox-sync (pg_cron, 2 min) reads every folder since a cursor and calls inbox_ingest_email per message.
-- Threads by Graph conversationId. Senders matched to customers (contacts / portal users / customer email / domain) or agents.
-- Outbound (from the mailbox or any @ubfreight.com) counts as a staff reply, so Outlook replies clear the reply timer.

create table if not exists public.inbox_email_sync (
  mailbox text primary key,
  enabled boolean not null default false,
  default_team text,
  backfill_days int not null default 14,
  cursor_at timestamptz,
  backfilled_at timestamptz,
  last_run_at timestamptz,
  last_error text
);
insert into public.inbox_email_sync (mailbox, enabled, default_team, backfill_days)
values ('imports.nz@ubfreight.com', false, 'IS', 14) on conflict (mailbox) do nothing;

create table if not exists public.inbox_email_meta (
  message_id bigint primary key references public.inbox_messages(id) on delete cascade,
  mailbox text not null,
  graph_id text,
  internet_message_id text not null,
  thread_id text,
  subject text,
  from_address text,
  from_name text,
  to_list jsonb not null default '[]',
  cc_list jsonb not null default '[]',
  full_text text,
  web_link text
);
create index if not exists inbox_email_meta_thread on public.inbox_email_meta (mailbox, thread_id);

create table if not exists public.inbox_attachments (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.inbox_messages(id) on delete cascade,
  name text not null,
  content_type text,
  size int,
  s3_key text not null
);
create index if not exists inbox_attachments_msg on public.inbox_attachments (message_id);

-- Learned sender mapping: link once in the inbox, future mail from that address routes itself.
create table if not exists public.inbox_email_contacts (
  email text primary key,
  account_id text references public.customers(account_id) on delete set null,
  contact_type text,
  name text,
  updated_at timestamptz not null default now()
);

-- Senders never worth a conversation (ilike patterns on the from address).
create table if not exists public.inbox_email_skip (pattern text primary key, note text);
insert into public.inbox_email_skip (pattern, note) values
  ('%noreply%', 'no-reply senders'), ('%no-reply%', 'no-reply senders'), ('%donotreply%', 'no-reply senders'),
  ('%do-not-reply%', 'no-reply senders'), ('mailer-daemon@%', 'bounces'), ('postmaster@%', 'bounces'),
  ('%newsletter%', 'marketing'), ('%marketing%', 'marketing'), ('%@linkedin.com', 'social'), ('%@mailchimp%', 'marketing')
on conflict (pattern) do nothing;

alter table public.inbox_email_sync enable row level security;
alter table public.inbox_email_meta enable row level security;
alter table public.inbox_attachments enable row level security;
alter table public.inbox_email_contacts enable row level security;
alter table public.inbox_email_skip enable row level security;
create policy staff_read on public.inbox_email_sync for select to authenticated using (public.is_staff());
create policy staff_read on public.inbox_email_meta for select to authenticated using (public.is_staff());
create policy staff_read on public.inbox_attachments for select to authenticated using (public.is_staff());
create policy staff_read on public.inbox_email_contacts for select to authenticated using (public.is_staff());
create policy staff_read on public.inbox_email_skip for select to authenticated using (public.is_staff());

create index if not exists contacts_email_domain_idx on public.contacts (split_part(lower(email), '@', 2));
create index if not exists portal_users_email_lower_idx on public.portal_users (lower(email));

create or replace function public.inbox_match_email(p_addr text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
  if d <> '' and d not in ('gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'xtra.co.nz', 'icloud.com', 'live.com',
                           'outlook.co.nz', 'yahoo.co.nz', 'hotmail.co.nz', 'qq.com', '163.com', '126.com', 'ubfreight.com') then
    select min(account_id), count(distinct account_id) into v_acc, n from public.contacts where split_part(lower(email), '@', 2) = d;
    if n = 1 then return jsonb_build_object('account_id', v_acc, 'contact_type', 'customer', 'name', null, 'how', 'domain'); end if;
  end if;
  return null;
end $$;

create or replace function public.inbox_ingest_email(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_imid text := p->>'internet_message_id'; v_mb text := lower(p->>'mailbox'); v_thread text := p->>'thread_id';
  v_from text := lower(p#>>'{from,address}'); v_fname text := nullif(btrim(coalesce(p#>>'{from,name}', '')), '');
  v_out boolean := coalesce((p->>'outbound')::boolean, false); v_at timestamptz := (p->>'at')::timestamptz;
  v_subj text := coalesce(p->>'subject', ''); v_body text := coalesce(nullif(btrim(p->>'body'), ''), left(coalesce(p->>'full_text', ''), 4000));
  v_conv uuid; v_mid bigint; m jsonb; v_other text; v_oname text; v_ref text; v_bk uuid; v_mod text; v_bacc text; v_team text; v_kind text;
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
            'open', v_at, v_at)
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
  return jsonb_build_object('status', 'inserted', 'message_id', v_mid, 'conversation_id', v_conv);
end $$;
revoke execute on function public.inbox_ingest_email(jsonb) from public, anon, authenticated;
grant execute on function public.inbox_ingest_email(jsonb) to service_role;

-- After the first backfill catches up: old threads stay as history (closed), recent ones stay open.
create or replace function public.inbox_email_finish_backfill(p_mailbox text)
returns void language sql security definer set search_path = public as $$
  update public.inbox_conversations set status = 'closed', reply_due_at = null
   where email_mailbox = lower(p_mailbox) and status = 'open' and last_message_at < now() - interval '3 days';
  update public.inbox_email_sync set backfilled_at = now() where mailbox = lower(p_mailbox);
$$;
revoke execute on function public.inbox_email_finish_backfill(text) from public, anon, authenticated;
grant execute on function public.inbox_email_finish_backfill(text) to service_role;

notify pgrst, 'reload schema';

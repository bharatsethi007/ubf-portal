-- Unified inbox core: one conversation model over portal messages + WhatsApp (WeChat/email later).
-- Channels keep writing their own tables; triggers mirror every message into inbox_messages.
--   inbox_conversations  one row per conversation (portal thread 1:1, or WhatsApp contact / account general)
--   inbox_messages       unified timeline: message | note | event, tagged with channel
--   inbox_reads          per staff read marker
-- Applied via MCP 6 Oct 2026 (first-run form, no drop guards). Repo parity file, do not re-run.

alter table public.whatsapp_contacts add column if not exists contact_type text;
alter table public.whatsapp_contacts add constraint whatsapp_contacts_contact_type_check
  check (contact_type is null or contact_type in ('customer', 'lead', 'carrier', 'shipper', 'agent', 'spam'));
alter table public.whatsapp_contacts add column if not exists company text;

create table if not exists public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  account_id text references public.customers(account_id) on delete set null,
  wa_contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  portal_thread_id uuid unique references public.portal_threads(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  job_unique bigint,
  subject text,
  team text,
  assignee_id uuid references public.staff_users(user_id) on delete set null,
  status text not null default 'open' check (status in ('open', 'snoozed', 'closed')),
  snoozed_until timestamptz,
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_channel text,
  last_sender text,
  last_preview text,
  reply_due_at timestamptz,
  first_reply_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists inbox_conv_recent on public.inbox_conversations (status, last_message_at desc);
create index if not exists inbox_conv_assignee on public.inbox_conversations (assignee_id, status);
create index if not exists inbox_conv_wa on public.inbox_conversations (wa_contact_id, last_message_at desc);
create index if not exists inbox_conv_account on public.inbox_conversations (account_id, last_message_at desc);

create table if not exists public.inbox_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  channel text not null check (channel in ('portal', 'whatsapp', 'wechat', 'email', 'internal')),
  kind text not null default 'message' check (kind in ('message', 'note', 'event')),
  direction text check (direction in ('in', 'out')),
  sender_kind text not null check (sender_kind in ('customer', 'contact', 'staff', 'system')),
  sender_user_id uuid,
  sender_name text,
  body text,
  msg_type text,
  media_path text,
  status text,
  source text,
  source_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists inbox_msg_source on public.inbox_messages (source, source_id) where source is not null;
create index if not exists inbox_msg_conv on public.inbox_messages (conversation_id, created_at);

create table if not exists public.inbox_reads (
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.inbox_conversations enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.inbox_reads enable row level security;
create policy staff_read on public.inbox_conversations for select to authenticated using (public.is_staff());
create policy staff_read on public.inbox_messages for select to authenticated using (public.is_staff());
create policy own_reads on public.inbox_reads for select to authenticated using (user_id = auth.uid());

-- ---------- helpers ----------
create or replace function public.inbox_staff_name(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(coalesce(full_name, '')), ''),
                  nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), email)
    from public.staff_users where user_id = p_uid
$$;

create or replace function public.inbox_bump(p_conv uuid, p_at timestamptz, p_channel text, p_sender text, p_preview text)
returns void language plpgsql security definer set search_path = public as $$
declare v_in boolean := p_sender in ('customer', 'contact');
begin
  update public.inbox_conversations c set
    last_message_at = greatest(c.last_message_at, p_at),
    last_channel = p_channel,
    last_sender = p_sender,
    last_preview = left(regexp_replace(coalesce(p_preview, ''), '\s+', ' ', 'g'), 200),
    last_inbound_at = case when v_in then p_at else c.last_inbound_at end,
    reply_due_at = case when v_in then coalesce(c.reply_due_at, p_at + interval '1 hour')
                        when p_sender = 'staff' then null else c.reply_due_at end,
    first_reply_at = case when p_sender = 'staff' then coalesce(c.first_reply_at, p_at) else c.first_reply_at end,
    status = case when v_in then 'open' else c.status end,
    snoozed_until = case when v_in then null else c.snoozed_until end
  where c.id = p_conv;
end $$;

-- ---------- portal ----------
create or replace function public.inbox_conv_for_portal(p_thread uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; t public.portal_threads;
begin
  select id into v_id from public.inbox_conversations where portal_thread_id = p_thread;
  if v_id is not null then return v_id; end if;
  select * into t from public.portal_threads where id = p_thread;
  insert into public.inbox_conversations (account_id, portal_thread_id, booking_id, job_unique, subject, team, status, created_at, last_message_at)
  values (t.account_id, t.id, t.booking_id, t.job_unique, t.subject, t.module,
          case when t.status = 'closed' then 'closed' else 'open' end, t.created_at, t.created_at)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.inbox_ingest_portal(m public.portal_messages)
returns void language plpgsql security definer set search_path = public as $$
declare v_conv uuid := public.inbox_conv_for_portal(m.thread_id);
begin
  insert into public.inbox_messages (conversation_id, channel, kind, direction, sender_kind, sender_user_id, sender_name, body, source, source_id, created_at)
  values (v_conv, 'portal', 'message', case when m.sender_kind = 'staff' then 'out' else 'in' end,
          m.sender_kind, m.sender_user_id, m.sender_name, m.body, 'portal', m.id::text, m.created_at)
  on conflict do nothing;
  perform public.inbox_bump(v_conv, m.created_at, 'portal', m.sender_kind, m.body);
end $$;

create or replace function public.trg_inbox_portal_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin perform public.inbox_ingest_portal(new);
  exception when others then raise warning 'inbox portal mirror failed: %', sqlerrm; end;
  return new;
end $$;
create trigger trg_inbox_portal_message after insert on public.portal_messages
  for each row execute function public.trg_inbox_portal_message();

-- ---------- whatsapp ----------
create or replace function public.inbox_conv_for_wa(p_contact uuid, p_hint uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; c public.whatsapp_contacts;
begin
  if p_hint is not null and exists (select 1 from public.inbox_conversations where id = p_hint) then return p_hint; end if;
  select * into c from public.whatsapp_contacts where id = p_contact;
  select id into v_id from public.inbox_conversations
   where wa_contact_id = p_contact order by (status <> 'closed') desc, last_message_at desc limit 1;
  if v_id is null and c.account_id is not null then
    select id into v_id from public.inbox_conversations
     where account_id = c.account_id and booking_id is null and job_unique is null and status <> 'closed'
     order by last_message_at desc limit 1;
    if v_id is not null then update public.inbox_conversations set wa_contact_id = p_contact where id = v_id and wa_contact_id is null; end if;
  end if;
  if v_id is null then
    insert into public.inbox_conversations (account_id, wa_contact_id, subject, created_at, last_message_at)
    values (c.account_id, p_contact, 'WhatsApp', now(), now()) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.inbox_ingest_wa(m public.whatsapp_messages)
returns void language plpgsql security definer set search_path = public as $$
declare v_conv uuid; v_kind text; v_uid uuid; v_name text; c public.whatsapp_contacts;
begin
  v_conv := public.inbox_conv_for_wa(m.contact_id, nullif(m.raw ->> 'inbox_conversation_id', '')::uuid);
  select * into c from public.whatsapp_contacts where id = m.contact_id;
  if m.direction = 'inbound' then
    v_kind := case when c.account_id is not null then 'customer' else 'contact' end;
    v_name := c.display_name;
  else
    v_uid := nullif(m.raw ->> 'staff_uid', '')::uuid;
    v_kind := case when v_uid is not null then 'staff' else 'system' end;
    v_name := case when v_uid is not null then public.inbox_staff_name(v_uid) else 'Auto-reply' end;
  end if;
  insert into public.inbox_messages (conversation_id, channel, kind, direction, sender_kind, sender_user_id, sender_name,
                                     body, msg_type, media_path, status, source, source_id, created_at)
  values (v_conv, 'whatsapp', 'message', case when m.direction = 'inbound' then 'in' else 'out' end, v_kind, v_uid, v_name,
          m.body, m.msg_type, m.media_path, m.status, 'whatsapp', m.id::text, m.created_at)
  on conflict do nothing;
  perform public.inbox_bump(v_conv, m.created_at, 'whatsapp', v_kind, coalesce(m.body, '[' || coalesce(m.msg_type, 'media') || ']'));
end $$;

create or replace function public.trg_inbox_wa_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' then perform public.inbox_ingest_wa(new);
    else
      update public.inbox_messages set media_path = new.media_path, status = new.status
       where source = 'whatsapp' and source_id = new.id::text;
    end if;
  exception when others then raise warning 'inbox wa mirror failed: %', sqlerrm; end;
  return new;
end $$;
create trigger trg_inbox_wa_message after insert or update of media_path, status on public.whatsapp_messages
  for each row execute function public.trg_inbox_wa_message();

-- ---------- realtime ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inbox_messages') then
    alter publication supabase_realtime add table public.inbox_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'inbox_conversations') then
    alter publication supabase_realtime add table public.inbox_conversations;
  end if;
end $$;

-- ---------- backfill (once) ----------
do $$ declare r record; begin
  if exists (select 1 from public.inbox_messages) then return; end if;
  for r in
    select 'p' k, created_at, id::text sid from public.portal_messages
    union all select 'w', created_at, id::text from public.whatsapp_messages
    order by created_at
  loop
    if r.k = 'p' then perform public.inbox_ingest_portal(m) from public.portal_messages m where m.id = r.sid::bigint;
    else perform public.inbox_ingest_wa(m) from public.whatsapp_messages m where m.id = r.sid::uuid; end if;
  end loop;
  update public.inbox_conversations c set status = 'closed', reply_due_at = null
    from public.portal_threads t where c.portal_thread_id = t.id and t.status = 'closed';
  update public.inbox_conversations set reply_due_at = null where reply_due_at < now() - interval '2 days';
end $$;

notify pgrst, 'reload schema';

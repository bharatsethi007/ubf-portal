-- Portal messaging: customers talk to UBF teams inside the portal.
--   portal_threads      one per shipment / booking (reused while open), plus general threads. Routed to a team by module.
--   portal_messages     the messages. sender_kind customer | staff.
--   portal_thread_reads per user read marker (customers and staff), drives unread counts.
-- Customer RPCs (my_account_id-scoped): portal_threads_list, portal_thread_get, portal_message_send.
-- Staff RPCs (is_staff-gated): staff_threads_list, staff_thread_get, staff_message_send, staff_thread_set_status.
-- Customer message -> portal-message-notify Edge Function emails the team inbox.
-- Staff reply -> portal_notifications 'message' (bell + digest email per the customer's settings), flushed at once.
-- Idempotent.

create table if not exists public.portal_threads (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.customers(account_id) on delete cascade,
  job_unique bigint,
  booking_id uuid references public.bookings(id) on delete set null,
  module text,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_sender text check (last_sender in ('customer', 'staff')),
  last_preview text
);
create index if not exists portal_threads_account on public.portal_threads (account_id, last_message_at desc);
create index if not exists portal_threads_inbox on public.portal_threads (status, last_sender, last_message_at desc);

create table if not exists public.portal_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.portal_threads(id) on delete cascade,
  sender_user_id uuid references auth.users(id),
  sender_kind text not null check (sender_kind in ('customer', 'staff')),
  sender_name text,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists portal_messages_thread on public.portal_messages (thread_id, created_at);

create table if not exists public.portal_thread_reads (
  thread_id uuid not null references public.portal_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

-- All access goes through the RPCs below; staff can also read directly.
alter table public.portal_threads enable row level security;
alter table public.portal_messages enable row level security;
alter table public.portal_thread_reads enable row level security;
drop policy if exists staff_read on public.portal_threads;
create policy staff_read on public.portal_threads for select to authenticated using (public.is_staff());
drop policy if exists staff_read on public.portal_messages;
create policy staff_read on public.portal_messages for select to authenticated using (public.is_staff());

alter table public.portal_notifications drop constraint if exists portal_notifications_kind_check;
alter table public.portal_notifications add constraint portal_notifications_kind_check
  check (kind in ('shipment_created', 'eta_changed', 'departed', 'arrived', 'released', 'invoice_issued', 'message'));

-- ---------- customer ----------
create or replace function public.portal_threads_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'status', t.status, 'job_unique', t.job_unique, 'booking_id', t.booking_id,
    'last_message_at', t.last_message_at, 'last_sender', t.last_sender, 'last_preview', t.last_preview,
    'unread', (select count(*) from public.portal_messages m where m.thread_id = t.id and m.sender_kind = 'staff'
                 and m.created_at > coalesce((select r.read_at from public.portal_thread_reads r where r.thread_id = t.id and r.user_id = auth.uid()), '-infinity')),
    'shipment_no', (select case when s.module like 'FI%' and s.shipment_no is not null
                                  then s.module || '-' || s.shipment_no || case when coalesce(s.job_no, 1) > 1 then '/' || s.job_no else '' end
                                else coalesce(s.job_no::text, s.house_bill) end
                      from public.shipments s where s.job_unique = t.job_unique),
    'booking_ref', (select b.booking_ref from public.bookings b where b.id = t.booking_id)
  ) order by t.last_message_at desc), '[]'::jsonb)
  from public.portal_threads t
  where t.account_id = public.my_account_id()
$$;

create or replace function public.portal_thread_get(p_thread uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.portal_threads;
begin
  select * into t from public.portal_threads where id = p_thread and account_id = public.my_account_id();
  if not found then return null; end if;
  insert into public.portal_thread_reads (thread_id, user_id) values (t.id, auth.uid())
  on conflict (thread_id, user_id) do update set read_at = now();
  return jsonb_build_object('id', t.id, 'subject', t.subject, 'status', t.status, 'job_unique', t.job_unique,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.sender_kind, 'name', m.sender_name,
                                   'body', m.body, 'at', m.created_at, 'mine', m.sender_user_id = auth.uid()) order by m.created_at)
                          from public.portal_messages m where m.thread_id = t.id), '[]'::jsonb));
end $$;

-- Send a message. With no thread: reuses the open thread for that shipment / booking, else opens a new one.
create or replace function public.portal_message_send(p_thread uuid, p_body text, p_subject text default null,
                                                      p_job_unique bigint default null, p_booking uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  acct text := public.my_account_id();
  v_thread uuid := p_thread;
  v_module text;
  v_name text;
  v_body text := btrim(coalesce(p_body, ''));
  v_recent int;
begin
  if acct is null then raise exception 'Portal access required'; end if;
  if length(v_body) = 0 then raise exception 'Write a message first'; end if;
  if length(v_body) > 4000 then raise exception 'Messages can be up to 4,000 characters'; end if;
  select count(*) into v_recent from public.portal_messages m join public.portal_threads t on t.id = m.thread_id
   where t.account_id = acct and m.sender_kind = 'customer' and m.created_at > now() - interval '10 minutes';
  if v_recent >= 30 then raise exception 'Too many messages. Please wait a few minutes.'; end if;

  if v_thread is not null then
    perform 1 from public.portal_threads where id = v_thread and account_id = acct;
    if not found then raise exception 'Conversation not found'; end if;
    update public.portal_threads set status = 'open' where id = v_thread and status = 'closed';
  else
    if p_job_unique is not null then
      select right(s.module, 2) into v_module from public.portal_shipments s where s.job_unique = p_job_unique;
      if not found then raise exception 'Shipment not found'; end if;
      select id into v_thread from public.portal_threads where account_id = acct and job_unique = p_job_unique and status = 'open'
       order by last_message_at desc limit 1;
    elsif p_booking is not null then
      select b.module into v_module from public.portal_bookings b where b.id = p_booking;
      if not found then raise exception 'Booking not found'; end if;
      select id into v_thread from public.portal_threads where account_id = acct and booking_id = p_booking and status = 'open'
       order by last_message_at desc limit 1;
    end if;
    if v_thread is null then
      insert into public.portal_threads (account_id, job_unique, booking_id, module, subject, created_by)
      values (acct, p_job_unique, p_booking, v_module,
              coalesce(nullif(left(btrim(coalesce(p_subject, '')), 120), ''), left(v_body, 80)), auth.uid())
      returning id into v_thread;
    end if;
  end if;

  select coalesce(display_name, email) into v_name from public.portal_users where user_id = auth.uid();
  insert into public.portal_messages (thread_id, sender_user_id, sender_kind, sender_name, body)
  values (v_thread, auth.uid(), 'customer', v_name, v_body);
  insert into public.portal_thread_reads (thread_id, user_id) values (v_thread, auth.uid())
  on conflict (thread_id, user_id) do update set read_at = now();
  return v_thread;
end $$;

-- ---------- staff ----------
create or replace function public.staff_threads_list(p_status text default 'open')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'status', t.status, 'account_id', t.account_id, 'customer', c.name, 'module', t.module,
    'job_unique', t.job_unique, 'booking_id', t.booking_id, 'last_message_at', t.last_message_at, 'last_sender', t.last_sender,
    'last_preview', t.last_preview,
    'unread', (select count(*) from public.portal_messages m where m.thread_id = t.id and m.sender_kind = 'customer'
                 and m.created_at > coalesce((select r.read_at from public.portal_thread_reads r where r.thread_id = t.id and r.user_id = auth.uid()), '-infinity'))
  ) order by (t.last_sender = 'customer' and t.status = 'open') desc, t.last_message_at desc)
    from public.portal_threads t join public.customers c on c.account_id = t.account_id
   where (p_status = 'all' or t.status = p_status)
     and t.last_message_at > now() - interval '180 days'), '[]'::jsonb);
end $$;

create or replace function public.staff_thread_get(p_thread uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.portal_threads;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  select * into t from public.portal_threads where id = p_thread;
  if not found then return null; end if;
  insert into public.portal_thread_reads (thread_id, user_id) values (t.id, auth.uid())
  on conflict (thread_id, user_id) do update set read_at = now();
  return jsonb_build_object('id', t.id, 'subject', t.subject, 'status', t.status, 'account_id', t.account_id,
    'customer', (select name from public.customers where account_id = t.account_id), 'module', t.module,
    'job_unique', t.job_unique, 'booking_id', t.booking_id,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.sender_kind, 'name', m.sender_name,
                                   'body', m.body, 'at', m.created_at) order by m.created_at)
                          from public.portal_messages m where m.thread_id = t.id), '[]'::jsonb));
end $$;

create or replace function public.staff_message_send(p_thread uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_body text := btrim(coalesce(p_body, '')); v_name text;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if length(v_body) = 0 then raise exception 'Write a message first'; end if;
  if length(v_body) > 4000 then raise exception 'Messages can be up to 4,000 characters'; end if;
  perform 1 from public.portal_threads where id = p_thread;
  if not found then raise exception 'Conversation not found'; end if;
  select coalesce(nullif(btrim(coalesce(full_name, '')), ''), nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), email) into v_name
    from public.staff_users where user_id = auth.uid();
  insert into public.portal_messages (thread_id, sender_user_id, sender_kind, sender_name, body)
  values (p_thread, auth.uid(), 'staff', coalesce(v_name, 'UB Freight'), v_body);
  insert into public.portal_thread_reads (thread_id, user_id) values (p_thread, auth.uid())
  on conflict (thread_id, user_id) do update set read_at = now();
end $$;

create or replace function public.staff_thread_set_status(p_thread uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  if p_status not in ('open', 'closed') then raise exception 'Status must be open or closed'; end if;
  update public.portal_threads set status = p_status where id = p_thread;
end $$;

-- Threads with a customer message nobody on staff has answered yet (console badge).
create or replace function public.staff_threads_waiting()
returns int language sql stable security definer set search_path = public as $$
  select case when public.is_staff() then
    (select count(*)::int from public.portal_threads where status = 'open' and last_sender = 'customer') end
$$;

-- ---------- after each message ----------
create or replace function public.portal_message_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.portal_threads;
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  key text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
  hdr jsonb;
begin
  update public.portal_threads
     set last_message_at = new.created_at, last_sender = new.sender_kind, last_preview = left(new.body, 140)
   where id = new.thread_id
  returning * into t;
  hdr := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key);

  if new.sender_kind = 'customer' then
    if base is not null then
      perform net.http_post(url := base || '/functions/v1/portal-message-notify', headers := hdr,
        body := jsonb_build_object('message_id', new.id), timeout_milliseconds := 30000);
    end if;
  else
    insert into public.portal_notifications (account_id, job_unique, kind, dedupe_key, title, body, facts)
    values (t.account_id, t.job_unique, 'message', 'msg:' || new.id,
            'New message from ' || coalesce(new.sender_name, 'UB Freight'),
            left(new.body, 200) || case when length(new.body) > 200 then '…' else '' end,
            jsonb_build_object('thread_id', t.id, 'subject', t.subject))
    on conflict do nothing;
    if base is not null then
      perform net.http_post(url := base || '/functions/v1/portal-notify-send', headers := hdr,
        body := '{}'::jsonb, timeout_milliseconds := 60000);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_portal_message_after on public.portal_messages;
create trigger trg_portal_message_after after insert on public.portal_messages
  for each row execute function public.portal_message_after();

-- Payload for the team email (service role only).
create or replace function public.portal_message_notify_payload(p_message bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'message_id', m.id, 'body', m.body, 'sender_name', m.sender_name, 'sender_email', u.email, 'at', m.created_at,
    'thread_id', t.id, 'subject', t.subject, 'module', t.module, 'account_id', t.account_id, 'customer', c.name,
    'job_unique', t.job_unique,
    'shipment_no', (select case when s.module like 'FI%' and s.shipment_no is not null
                                  then s.module || '-' || s.shipment_no || case when coalesce(s.job_no, 1) > 1 then '/' || s.job_no else '' end
                                else coalesce(s.job_no::text, s.house_bill) end from public.shipments s where s.job_unique = t.job_unique),
    'booking_ref', (select booking_ref from public.bookings b where b.id = t.booking_id),
    'is_first', not exists (select 1 from public.portal_messages x where x.thread_id = t.id and x.id < m.id)
  )
  from public.portal_messages m
  join public.portal_threads t on t.id = m.thread_id
  join public.customers c on c.account_id = t.account_id
  left join public.portal_users u on u.user_id = m.sender_user_id
  where m.id = p_message and m.sender_kind = 'customer'
$$;

revoke all on function public.portal_threads_list() from public, anon;
revoke all on function public.portal_thread_get(uuid) from public, anon;
revoke all on function public.portal_message_send(uuid, text, text, bigint, uuid) from public, anon;
revoke all on function public.staff_threads_list(text) from public, anon;
revoke all on function public.staff_thread_get(uuid) from public, anon;
revoke all on function public.staff_message_send(uuid, text) from public, anon;
revoke all on function public.staff_thread_set_status(uuid, text) from public, anon;
revoke all on function public.staff_threads_waiting() from public, anon;
grant execute on function public.portal_threads_list(), public.portal_thread_get(uuid), public.portal_message_send(uuid, text, text, bigint, uuid),
  public.staff_threads_list(text), public.staff_thread_get(uuid), public.staff_message_send(uuid, text),
  public.staff_thread_set_status(uuid, text), public.staff_threads_waiting() to authenticated;
revoke all on function public.portal_message_after() from public, anon, authenticated;
revoke all on function public.portal_message_notify_payload(bigint) from public, anon, authenticated;

notify pgrst, 'reload schema';

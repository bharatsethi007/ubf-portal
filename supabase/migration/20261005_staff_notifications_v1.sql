-- Staff notifications v1: per-user reads, writers for mention/assign, customer doc, portal booking, quote decision,
-- feed/unread/mark-read RPCs, realtime. Idempotent. Run once in Supabase SQL editor.

alter table public.staff_notifications add column if not exists link text;
alter table public.staff_notifications add column if not exists actor_id uuid;

create table if not exists public.staff_notification_reads (
  notification_id bigint not null references public.staff_notifications(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);
alter table public.staff_notification_reads enable row level security;
drop policy if exists own_reads on public.staff_notification_reads;
create policy own_reads on public.staff_notification_reads for all to authenticated
  using (user_id = auth.uid() and (select public.is_staff())) with check (user_id = auth.uid() and (select public.is_staff()));

create or replace function public.staff_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), full_name, split_part(email, '@', 1))
    from public.staff_users where user_id = p_user;
$$;

create or replace function public.staff_notify(
  p_user uuid, p_booking uuid, p_task uuid, p_kind text, p_title text, p_body text,
  p_facts jsonb default '{}'::jsonb, p_actor_kind text default 'system', p_dedupe text default null, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is not null and p_user = auth.uid() then return; end if;
  if p_user is not null and not exists (select 1 from public.staff_users where user_id = p_user and coalesce(is_active, true)) then
    p_user := null;
  end if;
  insert into public.staff_notifications (user_id, booking_id, task_id, kind, title, body, facts, actor_kind, actor_id, dedupe_key, link)
  values (p_user, p_booking, p_task, p_kind, p_title, p_body, coalesce(p_facts, '{}'::jsonb), p_actor_kind, auth.uid(), p_dedupe, p_link)
  on conflict do nothing;
end $$;
revoke all on function public.staff_notify(uuid, uuid, uuid, text, text, text, jsonb, text, text, text) from public, anon, authenticated;

create or replace function public.booking_tasks_notify_staff()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref text; v_body text; v_actor text;
begin
  if new.audience <> 'staff' or new.assigned_to is null or new.status <> 'open' then return new; end if;
  if tg_op = 'UPDATE' and old.assigned_to is not distinct from new.assigned_to then return new; end if;
  select booking_ref into v_ref from public.bookings where id = new.booking_id;
  v_actor := coalesce(public.staff_name(coalesce(auth.uid(), new.created_by)), 'Someone');
  if new.source_comm_id is not null then
    select left(regexp_replace(body, '\s+', ' ', 'g'), 160) into v_body from public.booking_comms where id = new.source_comm_id;
    perform public.staff_notify(new.assigned_to, new.booking_id, new.id, 'mention',
      v_actor || ' mentioned you' || coalesce(' on ' || v_ref, ''), coalesce(v_body, new.title),
      jsonb_build_object('booking_ref', v_ref), 'staff', 'mention:' || new.id || ':' || new.assigned_to);
  else
    perform public.staff_notify(new.assigned_to, new.booking_id, new.id, 'task_assigned',
      v_actor || ' assigned you a task' || coalesce(' on ' || v_ref, ''), new.title,
      jsonb_build_object('booking_ref', v_ref, 'due', new.due_date), 'staff', 'assign:' || new.id || ':' || new.assigned_to);
  end if;
  return new;
end $$;
drop trigger if exists trg_booking_tasks_notify_staff on public.booking_tasks;
create trigger trg_booking_tasks_notify_staff after insert or update of assigned_to on public.booking_tasks
  for each row execute function public.booking_tasks_notify_staff();

create or replace function public.booking_docs_notify_staff()
returns trigger language plpgsql security definer set search_path = public as $$
declare b record;
begin
  if new.uploaded_via is distinct from 'customer' then return new; end if;
  select id, booking_ref, handled_by, coalesce(importer_name, '') imp into b from public.bookings where id = new.booking_id;
  perform public.staff_notify(b.handled_by, new.booking_id, null, 'customer_doc',
    'Customer uploaded ' || new.file_name, coalesce(b.booking_ref, '') || case when b.imp <> '' then ' / ' || b.imp else '' end,
    jsonb_build_object('document_id', new.id, 'file_name', new.file_name, 'booking_ref', b.booking_ref), 'customer', 'cdoc:' || new.id);
  return new;
end $$;
drop trigger if exists trg_booking_docs_notify_staff on public.booking_documents;
create trigger trg_booking_docs_notify_staff after insert on public.booking_documents
  for each row execute function public.booking_docs_notify_staff();

create or replace function public.bookings_notify_staff()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cust text;
begin
  if new.source is distinct from 'customer_portal' then return new; end if;
  select name into v_cust from public.customers where account_id = coalesce(new.account_id, new.importer_account_id, new.consignee_account_id);
  perform public.staff_notify(new.handled_by, new.id, null, 'portal_booking',
    'New portal booking request' || coalesce(' ' || new.booking_ref, ''),
    coalesce(v_cust, 'Customer') || coalesce(' · ' || new.origin || ' to ' || new.destination, ''),
    jsonb_build_object('booking_ref', new.booking_ref, 'customer', v_cust), 'customer', 'pbk:' || new.id);
  return new;
end $$;
drop trigger if exists trg_bookings_notify_staff on public.bookings;
create trigger trg_bookings_notify_staff after insert on public.bookings
  for each row execute function public.bookings_notify_staff();

create or replace function public.quote_responses_notify_staff()
returns trigger language plpgsql security definer set search_path = public as $$
declare q record;
begin
  if new.status not in ('approved', 'rejected') or old.status is not distinct from new.status then return new; end if;
  if new.decided_by is not null and exists (select 1 from public.staff_users where user_id = new.decided_by) then return new; end if;
  select qq.id, qq.quote_no, coalesce(qq.sales_executive_id, qq.pricing_executive_id, qq.created_by) owner, c.name cust
    into q from public.quotes qq left join public.customers c on c.account_id = qq.customer_account_id where qq.id = new.quote_id;
  perform public.staff_notify(q.owner, null, null, 'quote_decision',
    coalesce(q.cust, 'Customer') || case when new.status = 'approved' then ' approved ' else ' declined ' end || coalesce(q.quote_no, 'a quote'),
    coalesce(new.response_no, ''),
    jsonb_build_object('quote_id', q.id, 'quote_no', q.quote_no, 'response_id', new.id, 'status', new.status), 'customer',
    'qd:' || new.id || ':' || new.status, '/quotes/' || q.id || '/responses/' || new.id);
  return new;
end $$;
drop trigger if exists trg_quote_responses_notify_staff on public.quote_responses;
create trigger trg_quote_responses_notify_staff after update of status on public.quote_responses
  for each row execute function public.quote_responses_notify_staff();

create or replace function public.staff_notifications_feed(p_limit int default 60)
returns table (id bigint, kind text, title text, body text, booking_id uuid, link text, actor_kind text,
               is_team boolean, created_at timestamptz, is_read boolean, facts jsonb)
language sql stable set search_path = public as $$
  select n.id, n.kind, n.title, n.body, n.booking_id, n.link, n.actor_kind, n.user_id is null, n.created_at,
         exists (select 1 from public.staff_notification_reads r where r.notification_id = n.id and r.user_id = auth.uid()), n.facts
    from public.staff_notifications n
   where n.created_at > now() - interval '30 days'
   order by n.created_at desc
   limit least(coalesce(p_limit, 60), 200);
$$;

create or replace function public.staff_notifications_unread()
returns int language sql stable set search_path = public as $$
  select count(*)::int from public.staff_notifications n
   where n.created_at > now() - interval '30 days'
     and not exists (select 1 from public.staff_notification_reads r where r.notification_id = n.id and r.user_id = auth.uid());
$$;

create or replace function public.staff_notifications_mark_read(p_ids bigint[] default null)
returns int language plpgsql set search_path = public as $$
declare n int;
begin
  insert into public.staff_notification_reads (notification_id, user_id)
  select s.id, auth.uid() from public.staff_notifications s
   where (p_ids is null or s.id = any(p_ids)) and s.created_at > now() - interval '30 days'
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.staff_notifications_feed(int), public.staff_notifications_unread(), public.staff_notifications_mark_read(bigint[]) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'staff_notifications') then
    alter publication supabase_realtime add table public.staff_notifications;
  end if;
end $$;

notify pgrst, 'reload schema';

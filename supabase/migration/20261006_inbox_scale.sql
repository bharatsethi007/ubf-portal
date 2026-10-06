-- Inbox scale prep before email. Applied via MCP 6 Oct 2026. Idempotent.
-- 1. Denormalise channels + display name onto the conversation (kept fresh by a trigger on inbox_messages).
-- 2. Contact fields for email conversations (contact_email/name/type) and email thread keys.
-- 3. Trigram index for body search. 4. inbox_list / inbox_counts read the denormalised columns.

alter table public.inbox_conversations add column if not exists channels text[] not null default '{}';
alter table public.inbox_conversations add column if not exists who text;
alter table public.inbox_conversations add column if not exists contact_email text;
alter table public.inbox_conversations add column if not exists contact_name text;
alter table public.inbox_conversations add column if not exists contact_type text;
alter table public.inbox_conversations add column if not exists email_mailbox text;
alter table public.inbox_conversations add column if not exists email_thread_id text;
create index if not exists inbox_conv_email_thread on public.inbox_conversations (email_mailbox, email_thread_id);
create index if not exists inbox_msg_body_trgm on public.inbox_messages using gin (body gin_trgm_ops);
create index if not exists inbox_msg_conv_in on public.inbox_messages (conversation_id, created_at) where direction = 'in';

create or replace function public.trg_inbox_msg_denorm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'message' then
    update public.inbox_conversations c set
      channels = case when new.channel = any(c.channels) then c.channels else c.channels || new.channel end,
      who = case when new.direction = 'in' and nullif(btrim(coalesce(new.sender_name, '')), '') is not null then new.sender_name else c.who end
    where c.id = new.conversation_id
      and (not (new.channel = any(c.channels)) or (new.direction = 'in' and new.sender_name is distinct from c.who and new.sender_name is not null));
  end if;
  return new;
end $$;
create or replace trigger trg_inbox_msg_denorm after insert on public.inbox_messages
  for each row execute function public.trg_inbox_msg_denorm();

update public.inbox_conversations c set
  channels = coalesce((select array_agg(distinct m.channel) from public.inbox_messages m where m.conversation_id = c.id and m.kind = 'message'), '{}'),
  who = (select m.sender_name from public.inbox_messages m where m.conversation_id = c.id and m.direction = 'in' and m.sender_name is not null order by m.created_at desc limit 1);

create or replace function public.inbox_counts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  with c as (
    select c.*, public.inbox_eff_status(c.status, c.snoozed_until) eff, coalesce(wc.contact_type, c.contact_type) ctype
      from public.inbox_conversations c left join public.whatsapp_contacts wc on wc.id = c.wa_contact_id
  ), o as (select * from c where eff = 'open')
  select jsonb_build_object(
    'mine', (select count(*) from o where assignee_id = auth.uid()),
    'unassigned', (select count(*) from o where assignee_id is null),
    'unknown', (select count(*) from o where account_id is null and ctype is null),
    'all', (select count(*) from o),
    'snoozed', (select count(*) from c where eff = 'snoozed'),
    'overdue', (select count(*) from o where reply_due_at < now()),
    'awaiting', (select count(*) from o where reply_due_at is not null),
    'channels', (select coalesce(jsonb_object_agg(ch, n), '{}') from (select unnest(channels) ch, count(*) n from o group by 1) x),
    'teams', (select coalesce(jsonb_object_agg(team, n), '{}') from (select team, count(*) n from o where team is not null group by 1) x)
  ) into r;
  return r;
end $$;

create or replace function public.inbox_list(p_view text default 'all', p_channel text default null, p_team text default null,
                                             p_search text default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_where text; v_sql text; r jsonb;
begin
  if not public.is_staff() then raise exception 'Staff only'; end if;
  v_where := case coalesce(p_view, 'all')
    when 'mine' then 'eff = ''open'' and assignee_id = auth.uid()'
    when 'unassigned' then 'eff = ''open'' and assignee_id is null'
    when 'unknown' then 'eff = ''open'' and account_id is null and contact_type is null'
    when 'snoozed' then 'eff = ''snoozed'''
    when 'closed' then 'eff = ''closed'''
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
end $$;

notify pgrst, 'reload schema';

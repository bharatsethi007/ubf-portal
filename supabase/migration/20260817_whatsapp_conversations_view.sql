-- Staff inbox: one row per contact with last-message preview, needs-action count, and intent flags.
-- security_invoker=true so the caller's staff-only RLS on the base tables applies.
-- Applied live 2026-08-17.
create or replace view public.whatsapp_conversations
with (security_invoker = true) as
select
  c.id            as contact_id,
  c.wa_id,
  c.display_name,
  c.account_id,
  cust.name       as account_name,
  c.verified_at is not null as verified,
  c.opted_in,
  lm.body         as last_body,
  lm.direction    as last_direction,
  lm.msg_type     as last_type,
  lm.created_at   as last_at,
  (select count(*) from public.whatsapp_messages m2
     where m2.contact_id = c.id and m2.direction = 'inbound'
       and m2.status in ('received','flagged'))                         as needs_action_count,
  exists(select 1 from public.whatsapp_messages mi where mi.contact_id=c.id and mi.intent='tracking') as has_tracking,
  exists(select 1 from public.whatsapp_messages mi where mi.contact_id=c.id and mi.intent='booking')  as has_booking,
  exists(select 1 from public.whatsapp_messages mi where mi.contact_id=c.id and mi.intent='quote')    as has_quote
from public.whatsapp_contacts c
left join public.customers cust on cust.account_id = c.account_id
left join lateral (
  select body, direction, msg_type, created_at
  from public.whatsapp_messages m
  where m.contact_id = c.id
  order by created_at desc limit 1
) lm on true;

grant select on public.whatsapp_conversations to authenticated;
notify pgrst, 'reload schema';

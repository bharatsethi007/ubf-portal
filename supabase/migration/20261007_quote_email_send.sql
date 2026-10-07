-- Send quote from the console: thread picker + accept/decline links on quote emails.
alter table public.quote_reminders add column if not exists kind text not null default 'reminder';

-- Email threads that likely belong to this quote's customer, newest first.
-- Matches: same account, a known contact email, the customer's company domain, or free-text search.
drop function if exists public.quote_email_threads(uuid, text);
create function public.quote_email_threads(p_quote uuid, p_search text default null)
returns table(id uuid, subject text, mailbox text, contact_email text, contact_name text,
  last_message_at timestamptz, last_preview text, messages int, match text, suggested boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare q quotes; v_tail text;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  select * into q from quotes where quotes.id = p_quote;
  if q.id is null then return; end if;
  v_tail := nullif(right(coalesce(q.quote_no, ''), 4), '');
  return query
  with em as (
    select distinct lower(trim(e)) e from (
      select q.contact_email e
      union all select c.email from contacts c where c.account_id = q.customer_account_id
      union all select cu.email from customers cu where cu.account_id = q.customer_account_id
    ) x where e is not null and e like '%@%'
  ), dom as (
    select distinct split_part(e, '@', 2) d from em
    where split_part(e, '@', 2) not in ('gmail.com','outlook.com','hotmail.com','yahoo.com','xtra.co.nz','icloud.com',
      'live.com','msn.com','yahoo.co.nz','outlook.co.nz','ubfreight.com')
  ), hits as (
    select c.*,
      case when q.customer_account_id is not null and c.account_id = q.customer_account_id then 'account'
           when lower(c.contact_email) in (select e from em) then 'contact'
           when split_part(lower(c.contact_email), '@', 2) in (select d from dom) then 'domain'
           else 'search' end as m
    from inbox_conversations c
    where c.email_mailbox is not null
      and c.last_message_at > now() - interval '120 days'
      and (
        (q.customer_account_id is not null and c.account_id = q.customer_account_id)
        or lower(c.contact_email) in (select e from em)
        or split_part(lower(c.contact_email), '@', 2) in (select d from dom)
        or (nullif(trim(p_search), '') is not null and (c.subject ilike '%' || trim(p_search) || '%'
             or c.contact_email ilike '%' || trim(p_search) || '%' or c.contact_name ilike '%' || trim(p_search) || '%'))
      )
  )
  select h.id, h.subject, h.email_mailbox, h.contact_email, h.contact_name, h.last_message_at, h.last_preview,
    (select count(*)::int from inbox_messages m where m.conversation_id = h.id),
    h.m,
    (v_tail is not null and (h.subject ilike '%' || v_tail || '%' or h.subject ilike '%' || coalesce(q.quote_no, '~') || '%'))
  from hits h
  order by 10 desc, h.last_message_at desc
  limit 40;
end $$;
revoke all on function public.quote_email_threads(uuid, text) from public, anon;
grant execute on function public.quote_email_threads(uuid, text) to authenticated;

notify pgrst, 'reload schema';

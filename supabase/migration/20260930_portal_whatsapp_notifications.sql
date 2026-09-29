-- WhatsApp as a second customer notification channel, alongside email. Applied via MCP 30 Sep 2026
-- (portal_whatsapp_notifications, portal_wa_send_cron, portal_wa_outbox_name_fallback).
alter table public.portal_notify_prefs
  add column if not exists wa_enabled boolean not null default false,
  add column if not exists wa_off_kinds text[] not null default '{}';

alter table public.portal_notifications
  add column if not exists wa_status text,
  add column if not exists wa_sent_at timestamptz;
-- No backlog blast: everything already queued is skipped for WhatsApp.
update public.portal_notifications set wa_status = 'skipped' where wa_status is null;
alter table public.portal_notifications alter column wa_status set default 'pending';
create index if not exists portal_notifications_wa_pending on public.portal_notifications (created_at) where wa_status = 'pending';

alter table public.portal_notify_config
  add column if not exists wa_enabled boolean not null default false,
  add column if not exists wa_test_recipient text;

-- Prefs: one RPC for both channels. Null args keep the current value.
drop function if exists public.portal_notify_set_prefs(boolean, text[]);
create or replace function public.portal_notify_set_prefs(
  p_email boolean default null, p_off_kinds text[] default null,
  p_whatsapp boolean default null, p_wa_off_kinds text[] default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.portal_notify_prefs (user_id, email_enabled, off_kinds, wa_enabled, wa_off_kinds)
  values (auth.uid(), coalesce(p_email, false), coalesce(p_off_kinds, '{}'), coalesce(p_whatsapp, false), coalesce(p_wa_off_kinds, '{}'))
  on conflict (user_id) do update set
    email_enabled = coalesce(p_email, portal_notify_prefs.email_enabled),
    off_kinds     = coalesce(p_off_kinds, portal_notify_prefs.off_kinds),
    wa_enabled    = coalesce(p_whatsapp, portal_notify_prefs.wa_enabled),
    wa_off_kinds  = coalesce(p_wa_off_kinds, portal_notify_prefs.wa_off_kinds),
    updated_at = now();
  -- Turning WhatsApp on in the portal is explicit consent: lift a previous STOP.
  if p_whatsapp then
    update public.whatsapp_contacts set opted_in = true, opted_in_at = now()
     where portal_user_id = auth.uid() and verified_at is not null and not opted_in;
  end if;
end $$;
revoke all on function public.portal_notify_set_prefs(boolean, text[], boolean, text[]) from public, anon;
grant execute on function public.portal_notify_set_prefs(boolean, text[], boolean, text[]) to authenticated;

-- Linking a number (OTP confirm) switches WhatsApp updates on for that user.
create or replace function public.wa_contact_verified_prefs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.portal_user_id is not null and new.verified_at is not null
     and (tg_op = 'INSERT' or old.verified_at is distinct from new.verified_at) then
    insert into public.portal_notify_prefs (user_id, wa_enabled) values (new.portal_user_id, true)
    on conflict (user_id) do update set wa_enabled = true, updated_at = now();
  end if;
  return new;
end $$;
drop trigger if exists wa_contact_verified_prefs on public.whatsapp_contacts;
create trigger wa_contact_verified_prefs after insert or update of verified_at on public.whatsapp_contacts
  for each row execute function public.wa_contact_verified_prefs();

-- Caller's own WhatsApp link state, for the settings page.
create or replace function public.portal_wa_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('linked', true,
             'masked', '••••••' || right(c.wa_id, 4), 'opted_in', c.opted_in, 'verified_at', c.verified_at)
      from public.whatsapp_contacts c
     where c.portal_user_id = auth.uid() and c.verified_at is not null
     order by c.verified_at desc limit 1), jsonb_build_object('linked', false));
$$;
revoke all on function public.portal_wa_status() from public, anon;
grant execute on function public.portal_wa_status() to authenticated;

-- Outbox for the WhatsApp sender. Items older than 2 days are never sent (stale news).
create or replace function public.portal_wa_outbox(p_limit integer default 500)
returns jsonb language sql stable security definer set search_path = public as $$
  with pend as (
    select * from public.portal_notifications
     where wa_status = 'pending' order by created_at limit greatest(1, least(p_limit, 2000))
  ),
  rcpt as (
    select u.user_id, coalesce(nullif(trim(u.display_name), ''), c.display_name) display_name, u.account_id, c.wa_id,
           coalesce(p.wa_off_kinds, '{}') off_
      from public.portal_users u
      join public.portal_notify_prefs p on p.user_id = u.user_id and p.wa_enabled
      join lateral (select wa_id, display_name from public.whatsapp_contacts w
                     where w.portal_user_id = u.user_id and w.verified_at is not null and w.opted_in
                     order by w.verified_at desc limit 1) c on true
     where u.status = 'active'
  )
  select jsonb_build_object(
    'config', (select jsonb_build_object('wa_enabled', c.wa_enabled, 'test_recipient', c.wa_test_recipient) from public.portal_notify_config c where id),
    'ids', coalesce((select jsonb_agg(id) from pend where created_at >= now() - interval '2 days'), '[]'::jsonb),
    'stale', coalesce((select jsonb_agg(id) from pend where created_at < now() - interval '2 days'), '[]'::jsonb),
    'recipients', coalesce((
      select jsonb_agg(jsonb_build_object('wa_id', r.wa_id, 'name', r.display_name, 'account_id', r.account_id,
               'items', (select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body) order by n.created_at)
                           from pend n where n.account_id = r.account_id and n.created_at >= now() - interval '2 days'
                            and not (n.kind = any (r.off_)))))
        from rcpt r
       where exists (select 1 from pend n where n.account_id = r.account_id and n.created_at >= now() - interval '2 days'
                       and not (n.kind = any (r.off_)))), '[]'::jsonb)
  );
$$;

create or replace function public.portal_wa_mark(p_ids bigint[], p_status text)
returns void language sql security definer set search_path = public as $$
  update public.portal_notifications set wa_status = p_status, wa_sent_at = now()
   where id = any (p_ids) and wa_status = 'pending';
$$;
revoke all on function public.portal_wa_outbox(integer) from public, anon, authenticated;
revoke all on function public.portal_wa_mark(bigint[], text) from public, anon, authenticated;

insert into public.whatsapp_templates (name, category, language, purpose, body_params, status)
select 'ubf_shipment_update', 'UTILITY', 'en_US', 'Portal notification (shipment, invoice, message) to opted-in portal users',
       '["first name", "update title", "update detail"]'::jsonb, 'PENDING'
 where not exists (select 1 from public.whatsapp_templates where name = 'ubf_shipment_update');

-- WhatsApp updates every 30 min, roughly 7am to 9pm NZ. Off until portal_notify_config.wa_enabled or wa_test_recipient is set.
select cron.unschedule('portal-wa-send') where exists (select 1 from cron.job where jobname = 'portal-wa-send');
select cron.schedule('portal-wa-send', '20,50 18-23,0-7 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/portal-wa-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);

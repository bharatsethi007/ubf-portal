-- Durable auth history for staff (Supabase does not keep an audit table on this project).
create table if not exists public.staff_auth_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  event text not null,           -- login, logout, mfa_enrolled, mfa_verified, mfa_removed, password_changed,
                                 -- reset_link_sent, account_disabled, account_enabled
  ip text,
  user_agent text,
  actor_id uuid,                 -- who did it, when not the user themselves
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staff_auth_events_user_idx on public.staff_auth_events (user_id, created_at desc);

alter table public.staff_auth_events enable row level security;
drop policy if exists staff_auth_events_read on public.staff_auth_events;
create policy staff_auth_events_read on public.staff_auth_events for select to authenticated
  using (user_id = auth.uid() or public.has_perm('users', 'read'));
-- No insert/update/delete policies: rows only come from the triggers below.

create or replace function public.log_staff_auth_event(p_user uuid, p_event text, p_ip text, p_ua text, p_actor uuid, p_detail jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into staff_auth_events (user_id, event, ip, user_agent, actor_id, detail)
  values (p_user, p_event, nullif(split_part(p_ip, '/', 1), ''), p_ua, p_actor, p_detail);
exception when others then null;  -- never break auth
end $$;
revoke all on function public.log_staff_auth_event(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;

-- Sessions: insert = login, delete = sign out / session ended.
create or replace function public.trg_auth_sessions_log() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    perform log_staff_auth_event(new.user_id, 'login', new.ip::text, new.user_agent, null, null);
  elsif tg_op = 'DELETE' then
    perform log_staff_auth_event(old.user_id, 'logout', old.ip::text, old.user_agent, null, null);
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists staff_auth_sessions_log on auth.sessions;
create trigger staff_auth_sessions_log after insert or delete on auth.sessions
  for each row execute function public.trg_auth_sessions_log();

-- MFA factors: enrolled (verified) and removed.
create or replace function public.trg_auth_mfa_factors_log() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE' and new.status = 'verified' and old.status is distinct from 'verified' then
    perform log_staff_auth_event(new.user_id, 'mfa_enrolled', null, null, null, jsonb_build_object('type', new.factor_type));
  elsif tg_op = 'DELETE' and old.status = 'verified' then
    perform log_staff_auth_event(old.user_id, 'mfa_removed', null, null, auth.uid(), null);
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists staff_auth_mfa_factors_log on auth.mfa_factors;
create trigger staff_auth_mfa_factors_log after update or delete on auth.mfa_factors
  for each row execute function public.trg_auth_mfa_factors_log();

-- MFA challenges: code accepted.
create or replace function public.trg_auth_mfa_challenges_log() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_user uuid;
begin
  if new.verified_at is not null and old.verified_at is null then
    select user_id into v_user from auth.mfa_factors where id = new.factor_id;
    if v_user is not null then
      perform log_staff_auth_event(v_user, 'mfa_verified', new.ip_address::text, null, null, null);
    end if;
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists staff_auth_mfa_challenges_log on auth.mfa_challenges;
create trigger staff_auth_mfa_challenges_log after update on auth.mfa_challenges
  for each row execute function public.trg_auth_mfa_challenges_log();

-- Password changed.
create or replace function public.trg_auth_users_pw_log() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    perform log_staff_auth_event(new.id, 'password_changed', null, null, null, null);
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists staff_auth_users_pw_log on auth.users;
create trigger staff_auth_users_pw_log after update of encrypted_password on auth.users
  for each row execute function public.trg_auth_users_pw_log();

-- Reset / invite links issued.
create or replace function public.trg_staff_invite_tokens_log() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  perform log_staff_auth_event(new.user_id, 'reset_link_sent', null, null,
    case when new.created_by is distinct from new.user_id then new.created_by end, null);
  return null;
exception when others then return null;
end $$;
drop trigger if exists staff_invite_tokens_log on public.staff_invite_tokens;
create trigger staff_invite_tokens_log after insert on public.staff_invite_tokens
  for each row execute function public.trg_staff_invite_tokens_log();

-- Account disabled / enabled.
create or replace function public.trg_staff_users_active_log() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.is_active is distinct from old.is_active then
    perform log_staff_auth_event(new.user_id, case when new.is_active then 'account_enabled' else 'account_disabled' end,
      null, null, auth.uid(), null);
  end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists staff_users_active_log on public.staff_users;
create trigger staff_users_active_log after update of is_active on public.staff_users
  for each row execute function public.trg_staff_users_active_log();

-- Backfill what still exists.
insert into public.staff_auth_events (user_id, event, ip, user_agent, created_at)
select user_id, 'login', split_part(ip::text, '/', 1), user_agent, created_at from auth.sessions
where not exists (select 1 from public.staff_auth_events);
insert into public.staff_auth_events (user_id, event, ip, created_at)
select f.user_id, 'mfa_verified', split_part(c.ip_address::text, '/', 1), c.verified_at
from auth.mfa_challenges c join auth.mfa_factors f on f.id = c.factor_id where c.verified_at is not null;
insert into public.staff_auth_events (user_id, event, created_at)
select user_id, 'mfa_enrolled', updated_at from auth.mfa_factors where status = 'verified';
insert into public.staff_auth_events (user_id, event, actor_id, created_at)
select user_id, 'reset_link_sent', case when created_by is distinct from user_id then created_by end, created_at from public.staff_invite_tokens;

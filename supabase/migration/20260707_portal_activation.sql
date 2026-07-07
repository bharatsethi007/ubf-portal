-- Portal activation v2: portal_users lifecycle + invite tokens
-- Spec: portal-activation-spec-v2.md
-- Backfills existing portal_users to status='active' (they already have passwords).
-- Drops staff_delete_portal_users — revoke is soft status via portal-revoke-user only.

-- ── 1. Extend portal_users ────────────────────────────────────────────────

alter table public.portal_users
  add column if not exists status text not null default 'pending';

alter table public.portal_users
  drop constraint if exists portal_users_status_check;

alter table public.portal_users
  add constraint portal_users_status_check
  check (status in ('pending', 'active', 'revoked'));

alter table public.portal_users
  add column if not exists invited_by uuid references auth.users(id);

alter table public.portal_users
  add column if not exists activated_at timestamptz;

alter table public.portal_users
  add column if not exists last_login_at timestamptz;

alter table public.portal_users
  add column if not exists display_name text;

comment on column public.portal_users.status is
  'pending until customer sets password; active when portal access granted; revoked blocks gate.';
comment on column public.portal_users.invited_by is
  'staff auth.users.id who last activated this portal user.';
comment on column public.portal_users.display_name is
  'Optional friendly name shown in staff UI.';

-- Existing portal users (e.g. test login) already have passwords → active
update public.portal_users
set
  status       = 'active',
  activated_at = coalesce(activated_at, created_at, now())
where status = 'pending';

-- ── 2. Remove client-side delete (orphans auth user; bypasses Edge Function) ─

drop policy if exists staff_delete_portal_users on public.portal_users;

-- portal_users retains: staff_read_portal_users (SELECT), own_portal_user (SELECT).
-- No INSERT/UPDATE/DELETE policies for authenticated → writes via service_role only.

-- ── 3. Invite tokens (service_role only) ──────────────────────────────────

create table if not exists public.portal_invite_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  account_id  text not null references public.customers(account_id),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

comment on table public.portal_invite_tokens is
  'Single-use set-password tokens. No client access — Edge Functions only (service_role).';

create index if not exists portal_invite_tokens_user_id_idx
  on public.portal_invite_tokens (user_id);

create index if not exists portal_invite_tokens_expires_at_idx
  on public.portal_invite_tokens (expires_at)
  where used_at is null;

-- ── 4. RLS on token table ─────────────────────────────────────────────────

alter table public.portal_invite_tokens enable row level security;

-- No policies → authenticated/anon denied; service_role bypasses RLS.

revoke all on table public.portal_invite_tokens from anon, authenticated;
grant all on table public.portal_invite_tokens to service_role;

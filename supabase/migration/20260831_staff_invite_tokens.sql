-- Single-use staff set-password tokens. Mirrors portal_invite_tokens minus account_id.
-- Edge Functions only (service_role); no RLS policies. APPLIED LIVE 2026-08-31 via MCP.
create table if not exists public.staff_invite_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
comment on table public.staff_invite_tokens is 'Single-use staff set-password tokens. Edge Functions only (service_role).';
create index if not exists staff_invite_tokens_user_id_idx on public.staff_invite_tokens (user_id);
create index if not exists staff_invite_tokens_expires_at_idx on public.staff_invite_tokens (expires_at) where used_at is null;
alter table public.staff_invite_tokens enable row level security;
revoke all on table public.staff_invite_tokens from anon, authenticated;
grant all on table public.staff_invite_tokens to service_role;
notify pgrst, 'reload schema';

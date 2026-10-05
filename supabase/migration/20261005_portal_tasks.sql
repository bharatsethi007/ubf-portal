-- Portal tasks step 1: schema + logic
-- APPLIED LIVE via Supabase MCP 5 Oct 2026 (portal_tasks_schema, portal_tasks_logic).
-- Repo parity only. DO NOT RE-RUN.

-- ===== portal_tasks_schema =====
alter table public.shipping_lines add column if not exists detention_free_days int not null default 7;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='shipping_lines_detention_free_days_chk') then
    alter table public.shipping_lines add constraint shipping_lines_detention_free_days_chk check (detention_free_days between 0 and 60);
  end if;
end $$;
alter table public.bookings add column if not exists detention_free_days int;

alter table public.booking_containers
  add column if not exists planned_delivery_date date,
  add column if not exists delivery_window text,
  add column if not exists planned_return_date date,
  add column if not exists empty_ready_at timestamptz,
  add column if not exists empty_ready_by uuid;

alter table public.booking_tasks
  add column if not exists audience text not null default 'staff',
  add column if not exists kind text not null default 'todo',
  add column if not exists container_no text,
  add column if not exists account_id text,
  add column if not exists description text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists response jsonb,
  add column if not exists responded_by uuid,
  add column if not exists responded_at timestamptz,
  add column if not exists priority text not null default 'normal',
  add column if not exists parent_id uuid references public.booking_tasks(id) on delete cascade,
  add column if not exists auto_rule text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.booking_tasks drop constraint if exists booking_tasks_status_check;
alter table public.booking_tasks add constraint booking_tasks_status_check check (status in ('open','done','na','cancelled'));
alter table public.booking_tasks drop constraint if exists booking_tasks_audience_check;
alter table public.booking_tasks add constraint booking_tasks_audience_check check (audience in ('staff','customer'));
alter table public.booking_tasks drop constraint if exists booking_tasks_kind_check;
alter table public.booking_tasks add constraint booking_tasks_kind_check check (kind in ('todo','empty_ready','upload_docs','confirm_delivery','approve','question'));
alter table public.booking_tasks drop constraint if exists booking_tasks_priority_check;
alter table public.booking_tasks add constraint booking_tasks_priority_check check (priority in ('low','normal','high'));

create unique index if not exists booking_tasks_auto_rule_uq on public.booking_tasks (booking_id, auto_rule) where auto_rule is not null;
create index if not exists booking_tasks_customer_idx on public.booking_tasks (account_id, status) where audience = 'customer';
create index if not exists booking_tasks_assignee_idx on public.booking_tasks (assigned_to, status);
create index if not exists booking_tasks_parent_idx on public.booking_tasks (parent_id) where parent_id is not null;

create table if not exists public.booking_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.booking_tasks(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  author_kind text not null default 'staff' check (author_kind in ('staff','customer')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists booking_task_comments_task_idx on public.booking_task_comments (task_id, created_at);

create table if not exists public.staff_notifications (
  id bigint generated always as identity primary key,
  user_id uuid references public.staff_users(user_id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  task_id uuid references public.booking_tasks(id) on delete set null,
  kind text not null,
  title text not null,
  body text,
  facts jsonb not null default '{}'::jsonb,
  actor_kind text not null default 'system' check (actor_kind in ('system','staff','customer')),
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists staff_notifications_dedupe_uq on public.staff_notifications (dedupe_key) where dedupe_key is not null;
create index if not exists staff_notifications_user_idx on public.staff_notifications (user_id, created_at desc);
create index if not exists staff_notifications_unread_idx on public.staff_notifications (created_at desc) where read_at is null;

alter table public.booking_task_comments enable row level security;
alter table public.staff_notifications enable row level security;

drop policy if exists portal_select_booking_tasks on public.booking_tasks;
create policy portal_select_booking_tasks on public.booking_tasks for select to authenticated
  using (audience = 'customer' and account_id = (select public.my_account_id()));
drop policy if exists staff_all_booking_task_comments on public.booking_task_comments;
create policy staff_all_booking_task_comments on public.booking_task_comments for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists portal_select_task_comments on public.booking_task_comments;
create policy portal_select_task_comments on public.booking_task_comments for select to authenticated
  using (exists (select 1 from public.booking_tasks t where t.id = task_id and t.audience = 'customer' and t.account_id = (select public.my_account_id())));
drop policy if exists portal_insert_task_comments on public.booking_task_comments;
create policy portal_insert_task_comments on public.booking_task_comments for insert to authenticated
  with check (author_kind = 'customer' and author_id = auth.uid()
    and exists (select 1 from public.booking_tasks t where t.id = task_id and t.audience = 'customer' and t.account_id = (select public.my_account_id())));
drop policy if exists staff_read_staff_notifications on public.staff_notifications;
create policy staff_read_staff_notifications on public.staff_notifications for select to authenticated
  using ((select public.is_staff()) and (user_id is null or user_id = auth.uid()));
drop policy if exists staff_update_staff_notifications on public.staff_notifications;
create policy staff_update_staff_notifications on public.staff_notifications for update to authenticated
  using ((select public.is_staff()) and (user_id is null or user_id = auth.uid()))
  with check ((select public.is_staff()));

-- ===== portal_tasks_logic =====
-- Functions/views/triggers as applied live:
--   booking_customer_account(uuid)
--   booking_tasks_before() + trg_booking_tasks_before
--   v_container_dates (security_invoker) + portal_container_dates (scoped by my_account_id())
--   container_tracking_gate_out() + trg_container_tracking_gate_out
--   portal_complete_task(uuid, jsonb)
--   backfill of empty_ready tasks for gated-out, unreturned IS FCL containers
-- Full bodies: select pg_get_functiondef / pg_get_viewdef on the live DB (cpnkudbdzgnzmodhsrbf).

notify pgrst, 'reload schema';

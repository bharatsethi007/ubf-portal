-- 20260731_note_templates.sql  (already applied to production)
create table if not exists public.note_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  scope text not null default 'external',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists note_templates_scope_idx on public.note_templates (scope, name);
alter table public.note_templates enable row level security;
create policy note_templates_staff_all on public.note_templates for all using (is_staff()) with check (is_staff());

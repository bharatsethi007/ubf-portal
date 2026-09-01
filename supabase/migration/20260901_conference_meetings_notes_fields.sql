alter table public.conference_meetings
  add column if not exists notes_fields jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';

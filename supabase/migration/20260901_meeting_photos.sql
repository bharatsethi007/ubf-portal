create table if not exists public.meeting_photos (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.conference_meetings(id) on delete cascade,
  image_url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.meeting_photos enable row level security;

create policy staff_all_meeting_photos on public.meeting_photos
  for all using (public.is_staff()) with check (public.is_staff());

create index if not exists meeting_photos_meeting_idx on public.meeting_photos(meeting_id);

notify pgrst, 'reload schema';

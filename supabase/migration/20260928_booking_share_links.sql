-- APPLIED LIVE via Supabase MCP on 2026-09-28 (migrations: booking_share_links, ports_add_major_cn). Repo parity only, do not re-run.
-- Public tracking share links for Import Sea bookings.
create table if not exists public.booking_share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  created_by uuid references public.staff_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count int not null default 0,
  refresh_started_at timestamptz,
  base_route jsonb
);
create index if not exists booking_share_links_booking_idx on public.booking_share_links(booking_id);
alter table public.booking_share_links enable row level security;
drop policy if exists staff_all_booking_share_links on public.booking_share_links;
create policy staff_all_booking_share_links on public.booking_share_links
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Staff creates a link: unguessable 32-char token generated server-side.
create or replace function public.create_booking_share_link(p_booking_id uuid, p_days int default 90)
returns public.booking_share_links
language plpgsql security definer set search_path = public as $$
declare r public.booking_share_links;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if not exists (select 1 from bookings where id = p_booking_id and mode = 'sea_import') then
    raise exception 'Only Import Sea bookings can be shared';
  end if;
  insert into booking_share_links(token, booking_id, created_by, expires_at)
  values (
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_'),
    p_booking_id, auth.uid(), now() + make_interval(days => greatest(1, least(coalesce(p_days, 90), 365)))
  ) returning * into r;
  return r;
end $$;
revoke all on function public.create_booking_share_link(uuid, int) from public, anon;
grant execute on function public.create_booking_share_link(uuid, int) to authenticated;

-- Major CN ports missing coordinates (needed for sea-route drawing).
insert into public.ports(code,name,lat,lng,kind,country_code) values
('CNNBO','Ningbo',29.9333,121.85,'sea','CN'),
('CNQDG','Qingdao',36.0667,120.3167,'sea','CN'),
('CNTNJ','Tianjin',38.9833,117.7833,'sea','CN')
on conflict (code) do update set lat=excluded.lat, lng=excluded.lng where public.ports.lat is null;

notify pgrst, 'reload schema';

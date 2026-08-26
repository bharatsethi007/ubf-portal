-- ============================================================
-- TMS Check-in sheet: standalone-capable + full sheet fields (5a-i).
-- Applied live to cpnkudbdzgnzmodhsrbf on 26 Aug 2026 via MCP.
-- Repo-parity copy for supabase/migration.
-- ============================================================

-- Sheet numbering (UBF-CS-YYYY-NNNN)
create table if not exists public.tms_checkin_seq (year int primary key, last_no int not null default 0);
alter table public.tms_checkin_seq enable row level security;

create or replace function public.tms_assign_sheet_no() returns trigger
language plpgsql security definer set search_path = public as $$
declare y int; n int;
begin
  if new.sheet_no is null or new.sheet_no = '' then
    y := extract(year from now())::int;
    insert into public.tms_checkin_seq(year, last_no) values (y, 1)
      on conflict (year) do update set last_no = public.tms_checkin_seq.last_no + 1
      returning last_no into n;
    new.sheet_no := 'UBF-CS-' || y || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end; $$;

-- Header + standalone party + link + storage hooks
alter table public.tms_checkin_sheets
  add column if not exists sheet_no text unique,
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists job_unique bigint,
  add column if not exists shipment_ref text,
  add column if not exists ref_input text,
  add column if not exists shipper_company text,
  add column if not exists shipper_address text,
  add column if not exists shipper_additional_info text,
  add column if not exists po_number text,
  add column if not exists reference text,
  add column if not exists consignee_port_country text,
  add column if not exists consignee_email text,
  add column if not exists warehouse_location text,
  add column if not exists is_consignee_unknown boolean not null default false,
  add column if not exists job_type text,
  add column if not exists picked_up_at timestamptz,
  add column if not exists delivered_by_name text,
  add column if not exists default_delivery_at timestamptz,
  add column if not exists tags text,
  add column if not exists console text,
  add column if not exists goods_type text not null default 'general',
  add column if not exists documents jsonb not null default '[]'::jsonb,
  add column if not exists checked_in_at timestamptz,
  add column if not exists booking_docs_attached text check (booking_docs_attached in ('yes','no')),
  add column if not exists damaged text check (damaged in ('yes','no')),
  add column if not exists fragile text check (fragile in ('yes','no')),
  add column if not exists temperature_controlled text check (temperature_controlled in ('yes','no')),
  add column if not exists physically_scanned text check (physically_scanned in ('yes','no'));

-- Convert the 5 existing screening booleans to three-state text (yes/no/null=unsure).
alter table public.tms_checkin_sheets
  drop column if exists known_shipper,
  drop column if exists sufficient_packaging,
  drop column if exists ipsm_pallet,
  drop column if exists statement_of_content,
  drop column if exists tamper_evident_form;
alter table public.tms_checkin_sheets
  add column known_shipper text check (known_shipper in ('yes','no')),
  add column sufficient_packaging text check (sufficient_packaging in ('yes','no')),
  add column ipsm_pallet text check (ipsm_pallet in ('yes','no')),
  add column statement_of_content text check (statement_of_content in ('yes','no')),
  add column tamper_evident_form text check (tamper_evident_form in ('yes','no'));

-- Cargo lines on the sheet (verified dims; standalone sheets carry their own)
create table if not exists public.tms_checkin_sheet_lines (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.tms_checkin_sheets(id) on delete cascade,
  type text, units numeric, weight_kg numeric,
  length_cm numeric, width_cm numeric, height_cm numeric, total_cube_m3 numeric, marks text,
  sort_order int not null default 0
);
create index if not exists tms_cs_lines_sheet_idx on public.tms_checkin_sheet_lines(sheet_id);
alter table public.tms_checkin_sheet_lines enable row level security;
drop policy if exists staff_all on public.tms_checkin_sheet_lines;
create policy staff_all on public.tms_checkin_sheet_lines for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select, insert, update, delete on public.tms_checkin_sheet_lines to authenticated;

-- numbering trigger
drop trigger if exists tms_checkin_assign_no on public.tms_checkin_sheets;
create trigger tms_checkin_assign_no before insert on public.tms_checkin_sheets
  for each row execute function public.tms_assign_sheet_no();

notify pgrst, 'reload schema';

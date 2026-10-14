-- 20261014e_sli_profiles.sql
-- Per-customer SLI preferences and saved template. Keyed by TW account (or supplier email when no account).
-- Written by the public sli-finish edge function (service role). Staff read/edit it on the customer profile.

create table if not exists public.sli_profiles (
  key               text primary key,              -- account_id, or 'email:<lower email>'
  account_id        text,
  email             text,
  save_template     boolean not null default false,
  email_pdf         boolean not null default false,
  pdf_email         text,
  template          jsonb,                         -- { prefilled: {...}, answers: {...}, signed_name }
  template_saved_at timestamptz,
  last_sli_id       uuid references public.sli_documents(id) on delete set null,
  updated_at        timestamptz not null default now()
);

create index if not exists sli_profiles_account_idx on public.sli_profiles (account_id);

alter table public.sli_profiles enable row level security;

drop policy if exists sli_profiles_staff_all on public.sli_profiles;
create policy sli_profiles_staff_all on public.sli_profiles
  for all to authenticated using (is_staff()) with check (is_staff());

-- Staff tab shows the PDF copy alongside uploaded documents.
comment on column public.sli_profiles.template is 'Shipper + standing answers reused on the next SLI. Never cargo details.';

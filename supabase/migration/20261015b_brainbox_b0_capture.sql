-- Brainbox B0: capture layer for quote learning.
-- Every quote line records where its number came from (rate_source) and what the
-- system first proposed (suggested_buy / suggested_sell). The first time a
-- system-sourced line is saved it is frozen into quote_line_proposals. When a quote
-- is sent, won or lost, the proposal is diffed against the final lines into
-- ai_corrections (kept / changed / removed / added). Manual "added" lines are the
-- library of rates staff quote when there is no rate card.

begin;

-- ── 1. Normaliser + charge aliases ─────────────────────────────────────────────
create or replace function public.brainbox_norm(p text)
returns text language sql immutable parallel safe as $$
  select nullif(lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')), '')
$$;

create table if not exists public.charge_aliases (
  id          uuid primary key default gen_random_uuid(),
  alias       text not null,
  charge_code text not null references public.charge_codes(code) on update cascade,
  source      text not null default 'staff' check (source in ('staff', 'backfill', 'learned')),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create unique index if not exists charge_aliases_norm_uq on public.charge_aliases (public.brainbox_norm(alias));
alter table public.charge_aliases enable row level security;
drop policy if exists staff_all_charge_aliases on public.charge_aliases;
create policy staff_all_charge_aliases on public.charge_aliases for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.brainbox_resolve_charge_code(p_desc text)
returns text language sql stable set search_path = public as $$
  select coalesce(
    (select c.code from charge_codes c
      where brainbox_norm(c.description) = brainbox_norm(p_desc)
      order by c.active desc, c.sort_order nulls last limit 1),
    (select a.charge_code from charge_aliases a
      where brainbox_norm(a.alias) = brainbox_norm(p_desc) limit 1))
$$;

-- ── 2. Provenance on quote lines ───────────────────────────────────────────────
alter table public.quote_response_lines
  add column if not exists charge_code    text,
  add column if not exists rate_source    text not null default 'manual',
  add column if not exists source_ref     text,
  add column if not exists suggested_buy  numeric,
  add column if not exists suggested_sell numeric;

alter table public.quote_response_lines drop constraint if exists quote_response_lines_rate_source_chk;
alter table public.quote_response_lines add constraint quote_response_lines_rate_source_chk
  check (rate_source in ('rate_card', 'local_charges', 'cartage', 'template', 'lane_history',
                         'margin_rule', 'brainbox_rule', 'manual'));
create index if not exists qrl_charge_code_idx on public.quote_response_lines (charge_code);
create index if not exists qrl_rate_source_idx on public.quote_response_lines (rate_source);

alter table public.quote_responses
  add column if not exists frozen_at     timestamptz,
  add column if not exists frozen_reason text;

-- Resolve charge code from description (exact charge code wording, then alias).
create or replace function public.trg_qrl_brainbox_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.rate_source is null then new.rate_source := 'manual'; end if;
  if tg_op = 'UPDATE' and new.description is distinct from old.description
     and new.charge_code is not distinct from old.charge_code then
    new.charge_code := null;
  end if;
  if new.charge_code is not null and not exists (select 1 from charge_codes where code = new.charge_code) then
    new.charge_code := null;
  end if;
  if new.charge_code is null and new.description is not null then
    new.charge_code := brainbox_resolve_charge_code(new.description);
  end if;
  return new;
end $$;

drop trigger if exists trg_qrl_brainbox_code on public.quote_response_lines;
create trigger trg_qrl_brainbox_code before insert or update on public.quote_response_lines
  for each row execute function public.trg_qrl_brainbox_code();

-- ── 3. What the system proposed, frozen at first save ──────────────────────────
-- line_id is NOT a foreign key: the editor deletes + reinserts lines on every save.
create table if not exists public.quote_line_proposals (
  line_id       uuid primary key,
  response_id   uuid not null references public.quote_responses(id) on delete cascade,
  quote_id      uuid not null references public.quotes(id) on delete cascade,
  charge_code   text,
  description   text,
  charge_group  text,
  rate_source   text not null,
  source_ref    text,
  vendor        text,
  unit          text,
  qty           numeric,
  buy_currency  text,
  sell_currency text,
  buy_rate      numeric,
  sell_rate     numeric,
  min_buy       numeric,
  min_sell      numeric,
  proposed_at   timestamptz not null default now(),
  superseded_at timestamptz
);
create index if not exists qlp_response_idx on public.quote_line_proposals (response_id);
alter table public.quote_line_proposals enable row level security;
drop policy if exists staff_read_quote_line_proposals on public.quote_line_proposals;
create policy staff_read_quote_line_proposals on public.quote_line_proposals for select using (public.is_staff());

create or replace function public.trg_qrl_brainbox_capture()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_quote uuid; v_n int;
begin
  select quote_id into v_quote from quote_responses where id = new.response_id;
  if v_quote is null then return null; end if;
  insert into quote_line_proposals (line_id, response_id, quote_id, charge_code, description, charge_group,
    rate_source, source_ref, vendor, unit, qty, buy_currency, sell_currency, buy_rate, sell_rate, min_buy, min_sell)
  values (new.id, new.response_id, v_quote, new.charge_code, new.description, new.charge_group,
    new.rate_source, new.source_ref, new.vendor, new.unit, new.qty, new.buy_currency, new.sell_currency,
    coalesce(new.suggested_buy, new.buy_rate), coalesce(new.suggested_sell, new.sell_rate), new.min_buy, new.min_sell)
  on conflict (line_id) do nothing;
  get diagnostics v_n = row_count;
  -- A different rate card applied to this option replaces the earlier proposal.
  if v_n > 0 and new.rate_source in ('rate_card', 'local_charges') and new.source_ref is not null then
    update quote_line_proposals set superseded_at = now()
     where response_id = new.response_id and superseded_at is null
       and rate_source in ('rate_card', 'local_charges') and source_ref is distinct from new.source_ref;
  end if;
  return null;
end $$;

drop trigger if exists trg_qrl_brainbox_capture on public.quote_response_lines;
create trigger trg_qrl_brainbox_capture after insert on public.quote_response_lines
  for each row when (new.rate_source <> 'manual') execute function public.trg_qrl_brainbox_capture();

-- ── 4. Shared proposal + correction log (quotes now, email extraction in B5) ───
create table if not exists public.ai_proposals (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in ('quote_response', 'quote_extraction', 'booking_extraction')),
  entity_id      uuid not null,
  source         text,
  model          text,
  prompt_version text,
  rules_used     uuid[] not null default '{}',
  proposed       jsonb not null,
  created_by     uuid default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists ai_proposals_entity_idx on public.ai_proposals (entity_type, entity_id);

create table if not exists public.ai_corrections (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('quote_response', 'quote_extraction', 'booking_extraction')),
  entity_id     uuid not null,
  proposal_id   uuid references public.ai_proposals(id) on delete set null,
  field_path    text not null,
  kind          text not null check (kind in ('kept', 'changed', 'added', 'removed')),
  proposed      jsonb,
  final         jsonb,
  reason_code   text check (reason_code in ('rate_wrong', 'missing_charge', 'customer_deal', 'carrier_change', 'extraction_error', 'other')),
  changed_by    uuid,
  frozen_reason text,
  at            timestamptz not null default now()
);
create index if not exists ai_corrections_entity_idx on public.ai_corrections (entity_type, entity_id);
create index if not exists ai_corrections_kind_idx on public.ai_corrections (kind);

alter table public.ai_proposals enable row level security;
alter table public.ai_corrections enable row level security;
drop policy if exists staff_all_ai_proposals on public.ai_proposals;
create policy staff_all_ai_proposals on public.ai_proposals for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists staff_all_ai_corrections on public.ai_corrections;
create policy staff_all_ai_corrections on public.ai_corrections for all using (public.is_staff()) with check (public.is_staff());

-- ── 5. Freeze: diff proposal vs final at send / won / lost / portal ────────────
create or replace function public.brainbox_freeze_quote(p_quote uuid, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_by uuid := auth.uid();
begin
  for r in select id from quote_responses
            where quote_id = p_quote and coalesce(status, '') not in ('rejected', 'withdrawn') loop
    delete from ai_corrections where entity_type = 'quote_response' and entity_id = r.id;

    insert into ai_corrections (entity_type, entity_id, field_path, kind, proposed, final, changed_by, frozen_reason)
    select 'quote_response', r.id, 'line/' || p.line_id,
      case when l.id is null then 'removed'
           when coalesce(l.buy_rate, 0) = coalesce(p.buy_rate, 0) and coalesce(l.sell_rate, 0) = coalesce(p.sell_rate, 0)
            and coalesce(l.qty, 0) = coalesce(p.qty, 0) and coalesce(l.min_sell, 0) = coalesce(p.min_sell, 0)
           then 'kept' else 'changed' end,
      to_jsonb(p), to_jsonb(l), v_by, p_reason
    from quote_line_proposals p
    left join quote_response_lines l on l.id = p.line_id
    where p.response_id = r.id and (p.superseded_at is null or l.id is not null);

    insert into ai_corrections (entity_type, entity_id, field_path, kind, proposed, final, changed_by, frozen_reason)
    select 'quote_response', r.id, 'line/' || l.id, 'added', null, to_jsonb(l), v_by, p_reason
    from quote_response_lines l
    where l.response_id = r.id
      and not exists (select 1 from quote_line_proposals p where p.line_id = l.id);

    update quote_responses set frozen_at = now(), frozen_reason = p_reason where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Triggers never block a send: failures only raise a warning.
create or replace function public.trg_brainbox_freeze_on_send()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'quote' and new.quote_id is not null then
    begin perform brainbox_freeze_quote(new.quote_id, 'sent');
    exception when others then raise warning 'brainbox freeze (sent) failed: %', sqlerrm; end;
  end if;
  return null;
end $$;
drop trigger if exists trg_brainbox_freeze_on_send on public.quote_reminders;
create trigger trg_brainbox_freeze_on_send after insert on public.quote_reminders
  for each row execute function public.trg_brainbox_freeze_on_send();

create or replace function public.trg_brainbox_freeze_on_outcome()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('won', 'lost') and new.status is distinct from old.status then
    begin perform brainbox_freeze_quote(new.id, new.status);
    exception when others then raise warning 'brainbox freeze (%) failed: %', new.status, sqlerrm; end;
  end if;
  return null;
end $$;
drop trigger if exists trg_brainbox_freeze_on_outcome on public.quotes;
create trigger trg_brainbox_freeze_on_outcome after update of status on public.quotes
  for each row execute function public.trg_brainbox_freeze_on_outcome();

create or replace function public.trg_brainbox_freeze_on_portal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sent_to_portal_at is not null and old.sent_to_portal_at is null then
    begin perform brainbox_freeze_quote(new.quote_id, 'portal');
    exception when others then raise warning 'brainbox freeze (portal) failed: %', sqlerrm; end;
  end if;
  return null;
end $$;
drop trigger if exists trg_brainbox_freeze_on_portal on public.quote_responses;
create trigger trg_brainbox_freeze_on_portal after update of sent_to_portal_at on public.quote_responses
  for each row execute function public.trg_brainbox_freeze_on_portal();

revoke execute on function public.brainbox_freeze_quote(uuid, text) from public, anon;
grant execute on function public.brainbox_freeze_quote(uuid, text) to authenticated, service_role;

-- ── 6. Brainbox module + Pricing Lead role (approvers = Bharat + pricing leads) ─
insert into public.app_modules (key, label, sort_order, is_active)
values ('brainbox', 'Brainbox', 95, true)
on conflict (key) do nothing;

insert into public.roles (key, name, description, is_preset, is_active)
values ('pricing_lead', 'Pricing Lead', 'Quotes plus Brainbox: writes and approves pricing rules.', true, true)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, module_key, can_read, can_add, can_edit, can_delete)
select r.id, m.module_key, true, true, true, m.can_delete
from public.roles r
cross join (values ('brainbox', false), ('quotes', false)) as m(module_key, can_delete)
where r.key = 'pricing_lead'
on conflict do nothing;

-- ── 7. Backfill ───────────────────────────────────────────────────────────────
insert into public.charge_aliases (alias, charge_code, source) values
  ('customs clearance for first 3 tariff lines', 'CUS', 'backfill'),
  ('extra lines for customs clerance', 'CUS', 'backfill'),
  ('import documentation', 'IMPORTDO', 'backfill'),
  ('import documentation fees', 'IMPORTDO', 'backfill'),
  ('export doc fee', 'EXPORTDO', 'backfill'),
  ('vbs and empty booking fee', 'VBSEMPTY', 'backfill'),
  ('container cartage - auckland metro', 'CONTAINE', 'backfill'),
  ('fcl container cartage 20ft', 'FCLCONTA', 'backfill'),
  ('fcl container cartage 40ft', 'CONTAINE', 'backfill'),
  ('edi fee', 'EDI', 'backfill'),
  ('port service fees', 'PORTSERV', 'backfill'),
  ('awb fee', 'AWB', 'backfill'),
  ('airfreight charges', 'AFR', 'backfill'),
  ('ocean freight incl dg surcharge', 'OFR', 'backfill'),
  ('cartage - subject to forklift onsite', 'LOCALCAR2', 'backfill'),
  ('cartage-subject to forklift onsite', 'LOCALCAR2', 'backfill'),
  ('local cartage - subject to forklift onsite', 'LOCALCAR2', 'backfill'),
  ('loose cargo delivery - auckland metro - subject to forklift on site', 'LOOSECAR', 'backfill'),
  ('loose cargo delivery - subject to forklift onsite', 'DEL', 'backfill'),
  ('loose cargo delivery(subject to forklift onsite)', 'DEL', 'backfill'),
  ('lcl delivery to fonterra, eltham - forklift onsite', 'DEL', 'backfill'),
  ('export pick up', 'CARTAGE', 'backfill'),
  ('cartage ( super freight )', 'CARTAGE', 'backfill'),
  ('facility processing fee (menzies)', 'TERMINAL', 'backfill'),
  ('loose/terminal handling fee', 'LOOSEHAN2', 'backfill'),
  ('loose/terminal handling fee (menzies)', 'LOOSEHAN2', 'backfill'),
  ('ex-work charges (origin charges)', 'EXWORKSC', 'backfill'),
  ('tech service fee', 'TECHSERV', 'backfill'),
  ('health lodgement fee', 'BIOSECUR', 'backfill'),
  ('tai lift truck surcharge', 'TAILLIFT', 'backfill'),
  ('tail lift surcharge', 'TAILLIFT', 'backfill'),
  ('container devanning - 40ft (palletised cargo)', 'DEVANNIN', 'backfill'),
  ('container devanning - palletized', 'DEVANNIN', 'backfill'),
  ('cfs packing/unpacking fuel surcharg', 'CFSUNPAC', 'backfill'),
  ('destination handling , clearance , delivery', 'DESTINAT', 'backfill'),
  ('atf fees', 'ATFFEE', 'backfill'),
  ('faf', 'FUELSURC', 'backfill'),
  ('faf 30%', 'FUELSURC', 'backfill'),
  ('faf 35%', 'FUELSURC', 'backfill'),
  ('faf 40%', 'FUELSURC', 'backfill'),
  ('40% faf', 'FUELSURC', 'backfill'),
  ('faf ( 30% of cartage )', 'FUELSURC', 'backfill'),
  ('cartage faf - 35%', 'FUELSURC', 'backfill'),
  ('container faf 35%', 'FUELSURC', 'backfill'),
  ('destination faf - 35%', 'FUELSURC', 'backfill'),
  ('destination fuel adjustment factor - 30% - faf 30%', 'FUELSURC', 'backfill'),
  ('fuel surcharge - local cartage', 'FUELSURC', 'backfill'),
  ('origin faf 35%', 'ORIGINFA', 'backfill')
on conflict do nothing;

-- Existing lines: resolve charge codes (trigger does the lookup).
update public.quote_response_lines set charge_code = null where charge_code is null and description is not null;

-- History: freeze quotes already sent, won or lost (all lines land as "added" = manual library).
select public.brainbox_freeze_quote(q.id, 'backfill')
from public.quotes q
where q.status in ('won', 'lost')
   or exists (select 1 from public.quote_reminders r where r.quote_id = q.id and r.kind = 'quote');

commit;

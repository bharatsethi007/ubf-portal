-- Agency module redesign, phase 1 (16 Oct 2026).
-- 1. agency_agreements + events (status, validity, offices, Schedule 1, e-sign fields).
-- 2. v_agent_agreement_state: one derived state per agent.
-- 3. v_agents_directory gains quote stats (12 months) and agreement state.
-- 4. agents_overview() and agent_stats() RPCs for the directory and profile headers.
-- Permission: has_perm('agreements','edit') = Admins + Pricing Leads.

create sequence if not exists public.agency_agreement_seq;

create table if not exists public.agency_agreements (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  agent_id uuid not null references public.agents(id) on delete cascade,
  kind text not null default 'non_exclusive' check (kind in ('non_exclusive','exclusive')),
  status text not null default 'draft' check (status in ('draft','sent','viewed','signed','void')),
  effective_date date not null default current_date,
  expiry_date date not null default (current_date + interval '3 years' - interval '1 day')::date,
  offices text[] not null default array['NZ','FJ','AU'],
  remind_days int not null default 45,
  agent_legal_name text,
  agent_address text,
  agent_company_no text,
  agent_territory text,
  signatory_name text,
  signatory_title text,
  signatory_email text,
  agent_contacts jsonb not null default '{}'::jsonb,   -- {operational, commercial, accounts, notices}
  ubf_contacts jsonb not null default jsonb_build_object(
    'operational','bharats@ubfreight.com','commercial','adal@ubfreight.com',
    'accounts','accounts.nz@ubfreight.com','notices','bharats@ubfreight.com'),
  currency text not null default 'USD',
  credit_limit text not null default 'USD 5,000 unless otherwise approved',
  payment_terms text not null default 'Monthly statement; payment by 20th following month',
  agent_payment_terms text,
  profit_share text not null default '50/50 where specifically applicable and agreed',
  insurance text not null default 'Freight forwarder liability / E&O and third-party cover',
  agent_insurance text,
  special_terms text,
  ubf_signer_id uuid references public.staff_users(user_id),
  ubf_signer_name text,
  ubf_signer_title text,
  ubf_signed_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  agent_signature jsonb,          -- {method: typed|drawn|upload, name, title, image_key?, ip, ua}
  sign_token_hash text unique,
  sign_token_expires_at timestamptz,
  signed_pdf_key text,
  created_by uuid default auth.uid() references public.staff_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date > effective_date)
);
create index if not exists agency_agreements_agent_idx on public.agency_agreements (agent_id, effective_date desc);

create table if not exists public.agency_agreement_events (
  id bigint generated always as identity primary key,
  agreement_id uuid not null references public.agency_agreements(id) on delete cascade,
  kind text not null,             -- created, updated, sent, viewed, details_confirmed, signed, filed, voided, reminded
  detail jsonb,
  actor text,                     -- staff email or 'agent'
  created_at timestamptz not null default now()
);
create index if not exists agency_agreement_events_idx on public.agency_agreement_events (agreement_id, created_at desc);

create or replace function public.agency_agreement_stamp()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' and new.ref is null then
    new.ref := 'AGR-' || to_char(now() at time zone 'Pacific/Auckland', 'YYYY') || '-' || lpad(nextval('agency_agreement_seq')::text, 3, '0');
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_agency_agreement_stamp on public.agency_agreements;
create trigger trg_agency_agreement_stamp before insert or update on public.agency_agreements
  for each row execute function public.agency_agreement_stamp();

alter table public.agency_agreements enable row level security;
alter table public.agency_agreement_events enable row level security;
drop policy if exists agency_agreements_read on public.agency_agreements;
create policy agency_agreements_read on public.agency_agreements for select using (is_staff());
drop policy if exists agency_agreements_write on public.agency_agreements;
create policy agency_agreements_write on public.agency_agreements for all
  using (has_perm('agreements','edit')) with check (has_perm('agreements','edit'));
drop policy if exists agency_agreement_events_read on public.agency_agreement_events;
create policy agency_agreement_events_read on public.agency_agreement_events for select using (is_staff());
drop policy if exists agency_agreement_events_write on public.agency_agreement_events;
create policy agency_agreement_events_write on public.agency_agreement_events for insert
  with check (has_perm('agreements','edit'));

-- Admin is_admin passes has_perm already; grant Pricing Lead.
insert into public.app_modules (key, label, sort_order, is_active)
values ('agreements', 'Agency agreements', 75, true)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, module_key, can_read, can_add, can_edit, can_delete)
select r.id, 'agreements', true, true, true, false from public.roles r where r.key in ('admin','pricing_lead')
on conflict do nothing;

-- One state per agent. Signed + in date wins, then awaiting, draft, expired.
create or replace view public.v_agent_agreement_state with (security_invoker = true) as
with a as (
  select g.*, (now() at time zone 'Pacific/Auckland')::date as today from public.agency_agreements g where g.status <> 'void'
), pick as (
  select distinct on (agent_id) agent_id, id, ref, status, effective_date, expiry_date, remind_days, today,
    case
      when status = 'signed' and expiry_date >= today then 1
      when status in ('sent','viewed') then 2
      when status = 'draft' then 3
      when status = 'signed' then 4
      else 5 end as rank
  from a
  order by agent_id,
    case when status = 'signed' and expiry_date >= today then 1 when status in ('sent','viewed') then 2
         when status = 'draft' then 3 when status = 'signed' then 4 else 5 end,
    expiry_date desc
)
select agent_id, id as agreement_id, ref, status, effective_date, expiry_date,
  case rank
    when 1 then case when expiry_date - today <= remind_days then 'expiring' else 'active' end
    when 2 then 'awaiting'
    when 3 then 'draft'
    else 'expired' end as state,
  (expiry_date - today) as days_left
from pick;

-- Quotes that belong to an agent: linked by agent_id, or quoted to the agent's account.
create or replace view public.v_agent_quotes with (security_invoker = true) as
select a.id as for_agent_id, q.*
from public.agents a
join public.quotes q on q.agent_id = a.id
  or (q.agent_id is null and a.erp_account_code is not null and q.customer_account_id = a.erp_account_code);

create or replace view public.v_agents_directory as
 select a.id, a.erp_account_code, a.name, a.country, a.source, a.status, a.trusted, a.approved_by,
    a.approved_at, a.notes, a.created_at, a.updated_at, la.last_activity,
    coalesce(la.job_count, 0::bigint) as job_count,
    coalesce(qs.quotes, 0) as quotes_12m,
    coalesce(qs.won, 0) as won_12m,
    coalesce(qs.lost, 0) as lost_12m,
    qs.hrs_to_win,
    qs.top_lane,
    qs.last_quote,
    coalesce(st.state, 'none') as agreement_state,
    st.expiry_date as agreement_expiry,
    st.days_left as agreement_days_left
   from agents a
     left join lateral ( select max(s.relevant_date) as last_activity, count(*) as job_count
           from shipments s where s.os_agent_code = a.erp_account_code) la on true
     left join lateral ( select count(*)::int as quotes,
            count(*) filter (where q.status in ('won','crosswin'))::int as won,
            count(*) filter (where q.status = 'lost')::int as lost,
            round((percentile_cont(0.5) within group (order by extract(epoch from q.won_at - q.created_at) / 3600.0)
              filter (where q.won_at is not null))::numeric, 1) as hrs_to_win,
            mode() within group (order by coalesce(q.from_port_code,'?') || ' > ' || coalesce(q.to_port_code,'?')) as top_lane,
            max(q.created_at) as last_quote
           from v_agent_quotes q where q.for_agent_id = a.id and q.created_at >= now() - interval '12 months') qs on true
     left join v_agent_agreement_state st on st.agent_id = a.id;

-- Directory header: totals, top lanes, agreement health, things needing action.
create or replace function public.agents_overview(p_months int default 12)
returns jsonb language sql stable set search_path to 'public' as $$
  with q as (
    select * from v_agent_quotes where created_at >= now() - make_interval(months => p_months)
  ), prior as (
    select count(*) n from v_agent_quotes
    where created_at < now() - make_interval(months => p_months)
      and created_at >= now() - make_interval(months => p_months * 2)
  ), shp as (
    select count(*) n, round(sum(coalesce(l.weight_kg, 0))) kg
    from shipment_legs l join agents a on a.erp_account_code = l.os_agent_code
    where coalesce(l.etd, l.doc_date) >= current_date - 365
  ), st as (select * from v_agent_agreement_state)
  select jsonb_build_object(
    'quotes', (select count(*) from q),
    'prior_quotes', (select n from prior),
    'won', (select count(*) filter (where status in ('won','crosswin')) from q),
    'lost', (select count(*) filter (where status = 'lost') from q),
    'active_agents', (select count(distinct for_agent_id) from q),
    'hrs_to_win', (select round((percentile_cont(0.5) within group (order by extract(epoch from won_at - created_at) / 3600.0))::numeric, 1) from q where won_at is not null),
    'shipments', (select n from shp), 'shipment_kg', (select kg from shp),
    'agents', (select count(*) from agents),
    'agreements', (select jsonb_build_object(
        'active', count(*) filter (where state = 'active'), 'expiring', count(*) filter (where state = 'expiring'),
        'expired', count(*) filter (where state = 'expired'), 'awaiting', count(*) filter (where state = 'awaiting'),
        'draft', count(*) filter (where state = 'draft')) from st),
    'lanes', coalesce((select jsonb_agg(x order by x.n desc) from (
        select coalesce(from_port_code,'?') || ' > ' || coalesce(to_port_code,'?') as lane, count(*) n,
               count(*) filter (where status in ('won','crosswin')) w
        from q where from_port_code is not null and to_port_code is not null
        group by 1 order by 2 desc limit 5) x), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(x order by x.o, x.d) from (
        select st.agent_id, a.name, st.state, st.expiry_date, st.days_left, st.ref,
               case st.state when 'expiring' then 1 when 'awaiting' then 2 when 'expired' then 3 else 4 end o,
               coalesce(st.days_left, 0) d
        from st join agents a on a.id = st.agent_id
        where st.state in ('expiring','awaiting','expired','draft')
        order by o, d limit 6) x), '[]'::jsonb)
  )
$$;

-- Profile header: KPIs, monthly trend, lanes.
create or replace function public.agent_stats(p_agent uuid, p_months int default 12)
returns jsonb language sql stable set search_path to 'public' as $$
  with a as (select * from agents where id = p_agent),
  q as (select * from v_agent_quotes where for_agent_id = p_agent and created_at >= now() - make_interval(months => p_months)),
  team as (select round(100.0 * count(*) filter (where status in ('won','crosswin')) / nullif(count(*), 0), 0) c
           from quotes where created_at >= now() - make_interval(months => p_months)),
  shp as (select l.* from shipment_legs l, a where l.os_agent_code = a.erp_account_code
          and coalesce(l.etd, l.doc_date) >= current_date - (p_months * 30)),
  months as (select generate_series(date_trunc('month', now()) - make_interval(months => p_months - 1), date_trunc('month', now()), interval '1 month') m)
  select jsonb_build_object(
    'quotes', (select count(*) from q),
    'open', (select count(*) filter (where status = 'open') from q),
    'held', (select count(*) filter (where status = 'held') from q),
    'won', (select count(*) filter (where status in ('won','crosswin')) from q),
    'lost', (select count(*) filter (where status = 'lost') from q),
    'hrs_to_win', (select round((percentile_cont(0.5) within group (order by extract(epoch from won_at - created_at) / 3600.0))::numeric, 1) from q where won_at is not null),
    'fastest_win', (select round(min(extract(epoch from won_at - created_at) / 3600.0)::numeric, 1) from q where won_at is not null),
    'team_conv', (select c from team),
    'shipments', (select count(*) from shp),
    'shipment_kg', (select round(sum(coalesce(weight_kg, 0))) from shp),
    'trend', (select jsonb_agg(jsonb_build_object('month', to_char(m.m, 'YYYY-MM'),
        'quotes', (select count(*) from q where date_trunc('month', q.created_at) = m.m),
        'won', (select count(*) from q where q.status in ('won','crosswin') and date_trunc('month', q.created_at) = m.m)) order by m.m) from months m),
    'modes', coalesce((select jsonb_agg(x order by x.n desc) from (
        select case when shipment_type ilike 'air' or shipment_mode ilike '%air%' then 'Air' else coalesce(upper(shipment_type), 'Other') end as mode, count(*) n
        from q group by 1) x), '[]'::jsonb),
    'lanes', coalesce((select jsonb_agg(x order by x.q desc, x.s desc) from (
        select coalesce(ql.lane, sl.lane) lane, coalesce(ql.q, 0) q, coalesce(ql.w, 0) w, coalesce(sl.s, 0) s, coalesce(sl.kg, 0) kg
        from (select from_port_code || ' > ' || to_port_code lane, count(*) q, count(*) filter (where status in ('won','crosswin')) w
              from q where from_port_code is not null and to_port_code is not null group by 1) ql
        full join (select origin || ' > ' || destination lane, count(*) s, round(sum(coalesce(weight_kg, 0))) kg
              from shp where origin is not null and destination is not null group by 1) sl on sl.lane = ql.lane
        order by coalesce(ql.q, 0) desc, coalesce(sl.s, 0) desc limit 8) x), '[]'::jsonb)
  )
$$;

grant execute on function public.agents_overview(int) to authenticated;
grant execute on function public.agent_stats(uuid, int) to authenticated;

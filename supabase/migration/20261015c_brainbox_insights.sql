-- Brainbox insights: price-source stats on quotes, no-card library, suggested rules.
-- Needs 20261015b_brainbox_b0_capture.sql.

begin;

-- ── 1. Lines saved before tracking began are "legacy", not "manual" ───────────
alter table public.quote_response_lines drop constraint if exists quote_response_lines_rate_source_chk;
alter table public.quote_response_lines add constraint quote_response_lines_rate_source_chk
  check (rate_source in ('rate_card', 'local_charges', 'cartage', 'template', 'lane_history',
                         'margin_rule', 'brainbox_rule', 'manual', 'legacy'));

-- Browsers still on the old app do not send rate_source, so the column default
-- marks their lines as untracked. The new app always sends it ('manual' when typed).
-- First run only (default still 'manual'): every line saved so far without provenance is untracked.
do $$
begin
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'quote_response_lines' and column_name = 'rate_source') like '%manual%' then
    update public.quote_response_lines set rate_source = 'legacy'
     where rate_source = 'manual' and suggested_sell is null;
  end if;
end $$;
alter table public.quote_response_lines alter column rate_source set default 'legacy';

-- Charges compare like with like: per kg against per kg, flat against flat.
create or replace function public.brainbox_unit_class(p_unit text)
returns text language sql immutable parallel safe as $$
  select case
    when p_unit is null or btrim(p_unit) = '' then 'flat'
    when lower(p_unit) ~ 'kg' then 'per_kg'
    when lower(p_unit) ~ 'w/?m' then 'per_wm'
    when lower(p_unit) ~ 'cbm' then 'per_cbm'
    when lower(p_unit) ~ 'teu' then 'per_teu'
    when lower(p_unit) ~ 'cont|20|40' then 'per_container'
    when lower(p_unit) ~ '%' then 'percent'
    else 'flat' end
$$;

-- ── 2. Rules (minimal; B1 adds the builder) ───────────────────────────────────
create table if not exists public.brainbox_rules (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('add_charge', 'remove_charge', 'set_rate', 'adjust_rate',
                                              'set_margin', 'min_sell', 'require_review', 'note')),
  scope         jsonb not null default '{}',
  action        jsonb not null default '{}',
  prose         text not null,
  priority      int not null default 100,
  status        text not null default 'draft' check (status in ('draft', 'suggested', 'active', 'retired', 'rejected')),
  origin        text not null default 'staff' check (origin in ('staff', 'learned')),
  evidence      jsonb,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  decided_by    uuid,
  decided_at    timestamptz,
  decision_note text
);
create index if not exists brainbox_rules_status_idx on public.brainbox_rules (status);
create index if not exists brainbox_rules_code_idx on public.brainbox_rules ((action->>'charge_code'));
alter table public.brainbox_rules enable row level security;
drop policy if exists staff_read_brainbox_rules on public.brainbox_rules;
create policy staff_read_brainbox_rules on public.brainbox_rules for select using (public.is_staff());
drop policy if exists staff_suggest_brainbox_rules on public.brainbox_rules;
create policy staff_suggest_brainbox_rules on public.brainbox_rules for insert
  with check (public.is_staff() and status in ('draft', 'suggested'));

-- ── 3. Charge stats: what the team actually quotes, per charge + currency + unit ─
-- Freight lines are left out: freight is priced per lane and belongs to rate cards.
drop function if exists public.brainbox_suggest_rule(text, text);
drop function if exists public.brainbox_charge_stats(int, text);
create or replace function public.brainbox_charge_stats(p_days int default 180, p_mode text default null)
returns table (
  key text, charge_code text, label text, currency text, unit_class text,
  n_quotes int, n_lines int, n_manual int,
  med numeric, mn numeric, mx numeric, mode_val numeric, mode_share numeric,
  last_used timestamptz, is_percent boolean, pattern text,
  rule_id uuid, rule_status text
)
language sql stable set search_path = public as $$
  with l as (
    select coalesce(l.charge_code, 'd:' || brainbox_norm(l.description)) as key,
           l.charge_code, l.description, coalesce(l.sell_currency, 'NZD') as currency,
           brainbox_unit_class(l.unit) as unit_class,
           l.sell_rate, l.rate_source, r.quote_id, r.created_at
    from quote_response_lines l
    join quote_responses r on r.id = l.response_id
    join quotes q on q.id = r.quote_id
    where l.sell_rate > 0 and brainbox_norm(l.description) is not null
      and coalesce(l.charge_group, '') <> 'freight'
      and coalesce(r.status, '') not in ('rejected', 'withdrawn')
      and r.created_at >= now() - make_interval(days => p_days)
      and (p_mode is null or q.shipment_mode = p_mode)
  ), agg as (
    select key, currency, unit_class, max(charge_code) as charge_code,
           mode() within group (order by description) as label,
           count(distinct quote_id)::int as n_quotes, count(*)::int as n_lines,
           count(*) filter (where rate_source in ('manual', 'legacy'))::int as n_manual,
           percentile_cont(0.5) within group (order by sell_rate)::numeric as med,
           min(sell_rate) as mn, max(sell_rate) as mx,
           mode() within group (order by sell_rate) as mode_val,
           max(created_at) as last_used,
           bool_or(description ~ '%') as is_percent
    from l group by key, currency, unit_class
  ), shares as (
    select a.*, round((select count(*) from l where l.key = a.key and l.currency = a.currency and l.unit_class = a.unit_class and l.sell_rate = a.mode_val)::numeric
                      / a.n_lines, 3) as mode_share
    from agg a
  )
  select s.key, s.charge_code, coalesce(c.description, s.label), s.currency, s.unit_class,
         s.n_quotes, s.n_lines, s.n_manual, round(s.med, 2), s.mn, s.mx, s.mode_val, s.mode_share,
         s.last_used, s.is_percent,
         case when s.is_percent or s.unit_class = 'percent' then 'percent'
              when s.n_quotes >= 10 and s.mode_share >= 0.9 then 'fixed'
              when s.mode_share >= 0.7 then 'mostly'
              else 'varies' end,
         br.id, br.status
  from shares s
  left join charge_codes c on c.code = s.charge_code
  left join lateral (
    select b.id, b.status from brainbox_rules b
    where s.charge_code is not null and b.action->>'charge_code' = s.charge_code
      and coalesce(b.action->>'currency', s.currency) = s.currency
      and coalesce(b.action->>'unit_class', s.unit_class) = s.unit_class
      and b.status in ('suggested', 'active')
    order by (b.status = 'active') desc, b.created_at desc limit 1
  ) br on true
$$;

-- ── 4. Library KPIs ───────────────────────────────────────────────────────────
create or replace function public.brainbox_kpis(p_days int default 30, p_mode text default null)
returns jsonb language sql stable set search_path = public as $$
  with l as (
    select l.*
    from quote_response_lines l
    join quote_responses r on r.id = l.response_id
    join quotes q on q.id = r.quote_id
    where coalesce(r.status, '') not in ('rejected', 'withdrawn')
      and r.created_at >= now() - make_interval(days => p_days)
      and (p_mode is null or q.shipment_mode = p_mode)
  ), card as (
    select * from l where rate_source in ('rate_card', 'local_charges') and suggested_sell is not null
  )
  select jsonb_build_object(
    'sources', coalesce((select jsonb_object_agg(rate_source, s) from
                 (select rate_source, round(sum(coalesce(total_sell, 0)), 2) s from l group by 1) x), '{}'),
    'card_lines', (select count(*) from card),
    'card_edited', (select count(*) from card where sell_rate is distinct from suggested_sell),
    'card_edit_avg_pct', (select round(avg((sell_rate - suggested_sell) / suggested_sell * 100), 1)
                          from card where suggested_sell > 0 and sell_rate is distinct from suggested_sell),
    'manual_charges', (select count(distinct coalesce(charge_code, brainbox_norm(description))) from l
                       where rate_source in ('manual', 'legacy') and description is not null),
    'uncoded', (select count(distinct brainbox_norm(description)) from l
                where charge_code is null and description is not null),
    'tracking_since', (select min(proposed_at) from quote_line_proposals)
  )
$$;

-- ── 5. One response: where its price came from + prompts ──────────────────────
create or replace function public.brainbox_response_insight(p_response uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_q record; v_out jsonb; v_sources jsonb; v_card jsonb; v_edit jsonb; v_manual jsonb;
  v_rule jsonb; v_sheet jsonb; v_n_manual int; v_has_local boolean; v_lane int; v_lane_manual int;
begin
  select r.id, r.quote_id, r.currency, q.shipment_mode, q.shipment_type, q.from_port_code, q.to_port_code
    into v_q
  from quote_responses r join quotes q on q.id = r.quote_id where r.id = p_response;
  if v_q.id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object('source', rate_source, 'sell', s, 'lines', n) order by s desc), '[]')
    into v_sources
  from (select rate_source, round(sum(coalesce(total_sell, 0)), 2) s, count(*) n
        from quote_response_lines where response_id = p_response group by 1) x;

  select jsonb_build_object(
           'lines', count(*),
           'total_lines', (select count(*) from quote_response_lines where response_id = p_response),
           'title', max(rc.title), 'vendor', max(coalesce(rc.vendor_name, l.vendor)), 'valid_to', max(rc.valid_to))
    into v_card
  from quote_response_lines l
  left join rate_cards rc on rc.id::text = l.source_ref
  where l.response_id = p_response and l.rate_source in ('rate_card', 'local_charges');

  select jsonb_build_object(
           'count', count(*),
           'delta', round(coalesce(sum((l.sell_rate - l.suggested_sell) * coalesce(l.qty, 1) * coalesce(l.ex_rate_sell, 1)), 0), 2),
           'base', round(coalesce(sum(l.suggested_sell * coalesce(l.qty, 1) * coalesce(l.ex_rate_sell, 1)), 0), 2),
           'lines', coalesce(jsonb_agg(jsonb_build_object('description', l.description, 'suggested', l.suggested_sell,
                       'final', l.sell_rate, 'unit', l.unit)) filter (where l.id is not null), '[]'))
    into v_edit
  from quote_response_lines l
  where l.response_id = p_response and l.suggested_sell is not null
    and l.rate_source <> 'manual' and l.sell_rate is distinct from l.suggested_sell;

  select jsonb_build_object(
           'count', count(*),
           'legacy', count(*) filter (where l.rate_source = 'legacy'),
           'in_range', count(*) filter (where s.n_quotes >= 3 and s.pattern in ('fixed', 'mostly') and l.sell_rate between s.mn and s.mx),
           'no_history', count(*) filter (where s.key is null or s.n_quotes < 3 or s.pattern not in ('fixed', 'mostly')),
           'outliers', coalesce(jsonb_agg(jsonb_build_object('description', l.description, 'sell', l.sell_rate,
                         'med', s.med, 'currency', s.currency, 'n', s.n_quotes))
                         filter (where s.n_quotes >= 3 and s.pattern in ('fixed', 'mostly')
                                   and l.sell_rate is distinct from s.mode_val
                                   and abs(l.sell_rate - s.mode_val) > 0.2 * s.mode_val), '[]'))
    into v_manual
  from quote_response_lines l
  left join brainbox_charge_stats(180, null) s on s.key = coalesce(l.charge_code, 'd:' || brainbox_norm(l.description))
                       and s.currency = coalesce(l.sell_currency, 'NZD') and s.unit_class = brainbox_unit_class(l.unit)
  where l.response_id = p_response and l.rate_source in ('manual', 'legacy')
    and coalesce(l.charge_group, '') <> 'freight';

  -- Prompt 1: a hand-typed charge that is always the same price and has no rule yet.
  select jsonb_build_object('kind', 'make_rule', 'key', s.key, 'charge_code', s.charge_code, 'label', s.label,
                            'value', s.mode_val, 'currency', s.currency, 'unit_class', s.unit_class, 'n', s.n_quotes)
    into v_rule
  from quote_response_lines l
  join brainbox_charge_stats(180, null) s on s.key = coalesce(l.charge_code, 'd:' || brainbox_norm(l.description))
                  and s.currency = coalesce(l.sell_currency, 'NZD') and s.unit_class = brainbox_unit_class(l.unit)
  where l.response_id = p_response and l.rate_source = 'manual'
    and s.pattern = 'fixed' and s.rule_id is null and s.charge_code is not null
    and s.unit_class = 'flat' and s.mode_val >= 1  -- rules for flat fees only for now
  order by s.n_quotes desc limit 1;

  -- Prompt 2: this lane keeps getting local charges by hand; suggest a charge sheet.
  select count(*) filter (where rate_source = 'manual'), bool_or(rate_source = 'local_charges')
    into v_n_manual, v_has_local
  from quote_response_lines where response_id = p_response;

  if v_n_manual >= 3 and not coalesce(v_has_local, false) then
    select count(distinct q.id), count(distinct q.id) filter (where m.n >= 3)
      into v_lane, v_lane_manual
    from quotes q
    join quote_responses r on r.quote_id = q.id
    left join lateral (select count(*) n from quote_response_lines x
                       where x.response_id = r.id and x.rate_source = 'manual') m on true
    where q.from_port_code is not distinct from v_q.from_port_code
      and q.to_port_code is not distinct from v_q.to_port_code
      and q.shipment_type is not distinct from v_q.shipment_type
      and q.created_at >= now() - interval '180 days';
    if v_lane_manual >= 2 then  -- only quotes priced after tracking began count
      v_sheet := jsonb_build_object('kind', 'local_sheet', 'n_manual', v_n_manual,
        'lane_quotes', v_lane, 'lane_manual', v_lane_manual,
        'path', case when v_q.shipment_mode = 'air' then 'air-local'
                     when upper(coalesce(v_q.shipment_type, '')) = 'LCL' then 'lcl-local' else 'fcl-local' end);
    end if;
  end if;

  v_out := jsonb_build_object(
    'currency', coalesce(v_q.currency, 'NZD'),
    'sources', v_sources, 'card', v_card, 'edited', v_edit, 'manual', v_manual,
    'prompts', to_jsonb(array_remove(array[v_rule, v_sheet], null)));
  return v_out;
end $$;

-- ── 6. Suggest a rule from a stat; decide a rule (approvers only) ─────────────
create or replace function public.brainbox_suggest_rule(p_key text, p_currency text, p_unit_class text default 'flat')
returns uuid language plpgsql security definer set search_path = public as $$
declare s record; v_id uuid;
begin
  if not is_staff() then raise exception 'Not allowed'; end if;
  select * into s from brainbox_charge_stats(180, null) x
   where x.key = p_key and x.currency = p_currency and x.unit_class = p_unit_class;
  if s.key is null then raise exception 'No history for this charge'; end if;
  if s.rule_id is not null then return s.rule_id; end if;

  insert into brainbox_rules (kind, scope, action, prose, status, origin, evidence)
  values (
    case when s.is_percent then 'note' else 'set_rate' end,
    '{}'::jsonb,
    jsonb_build_object('charge_code', s.charge_code, 'label', s.label, 'currency', s.currency, 'unit_class', s.unit_class,
                       'amount', case when s.is_percent then null else s.mode_val end),
    case when s.is_percent
         then format('%s is quoted as a percentage. Confirm what it is a percent of before pricing.', s.label)
         else format('%s: sell %s %s%s.', s.label, s.currency, trim(to_char(s.mode_val, 'FM999G999G990D00')),
                     case s.unit_class when 'flat' then '' else ' ' || replace(s.unit_class, '_', ' ') end) end,
    'suggested', 'learned',
    jsonb_build_object('n_quotes', s.n_quotes, 'median', s.med, 'min', s.mn, 'max', s.mx,
                       'mode_share', s.mode_share, 'pattern', s.pattern, 'window_days', 180))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.brainbox_rule_decide(p_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('brainbox', 'edit') then raise exception 'Only Bharat or a Pricing Lead can approve rules'; end if;
  if p_decision not in ('active', 'rejected', 'retired') then raise exception 'Bad decision'; end if;
  update brainbox_rules
     set status = p_decision, decided_by = auth.uid(), decided_at = now(),
         decision_note = p_note, updated_at = now()
   where id = p_id;
end $$;

revoke execute on function public.brainbox_suggest_rule(text, text, text) from public, anon;
revoke execute on function public.brainbox_rule_decide(uuid, text, text) from public, anon;
grant execute on function public.brainbox_suggest_rule(text, text, text) to authenticated;
grant execute on function public.brainbox_rule_decide(uuid, text, text) to authenticated;
grant execute on function public.brainbox_charge_stats(int, text) to authenticated;
grant execute on function public.brainbox_kpis(int, text) to authenticated;
grant execute on function public.brainbox_response_insight(uuid) to authenticated;

commit;

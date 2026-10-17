-- Agents across companies (M7).
-- One agent (shared master) can hold many ERP accounts, in any company:
--   agent_company_codes(company_id, erp_code) -> agent_id      raw code, as in that company's TradeWindow
--   v_agent_codes.code = company key_prefix || erp_code          matches shipments.os_agent_code ('LLL' / 'FJ:LLL')
-- Every agent report joins through v_agent_codes, so all of an agent's accounts count, and each report
-- carries a company split. Company scope still follows the topbar picker (scoped views / RLS).
-- Review queue: suggests an existing agent (same code in another company, or similar name) and can
-- link a code to it. Own-office accounts (companies.erp_exclude_accounts) are excluded automatically.

-- ── 1. Code map: many codes per agent per company ──────────────────────────────────────────────
alter table public.agent_company_codes drop constraint if exists agent_company_codes_pkey;
-- (company_id, erp_code) stays unique: one code belongs to one agent.
create index if not exists agent_company_codes_agent on public.agent_company_codes (agent_id);

-- Split a namespaced code ('FJ:LLL' / 'LLL') into company + raw ERP code.
-- Un-prefixed codes (NZ ERP codes, portal 'P-' codes) belong to the company with the empty prefix.
create or replace function public.agent_code_split(p_code text, out company_id text, out erp_code text)
language sql stable set search_path = public as $$
  select coalesce(
           (select c.code from public.companies c where c.key_prefix <> '' and p_code like c.key_prefix || '%'
             order by length(c.key_prefix) desc limit 1),
           (select c.code from public.companies c where c.key_prefix = '' order by c.sort_order limit 1),
           'NZ'),
         coalesce(
           (select substr(p_code, length(c.key_prefix) + 1) from public.companies c
             where c.key_prefix <> '' and p_code like c.key_prefix || '%' order by length(c.key_prefix) desc limit 1),
           p_code)
$$;

-- Backfill: every agent's own account is one of its codes.
insert into public.agent_company_codes (agent_id, company_id, erp_code)
select a.id, s.company_id, s.erp_code
from public.agents a cross join lateral public.agent_code_split(a.erp_account_code) s
where a.erp_account_code is not null
on conflict (company_id, erp_code) do nothing;

-- Keep it that way for agents created or re-coded anywhere (review accept, portal agents, sync).
create or replace function public.agents_code_map_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.erp_account_code is not null
     and (tg_op = 'INSERT' or new.erp_account_code is distinct from old.erp_account_code) then
    insert into public.agent_company_codes (agent_id, company_id, erp_code)
    select new.id, s.company_id, s.erp_code from public.agent_code_split(new.erp_account_code) s
    on conflict (company_id, erp_code) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists agents_code_map on public.agents;
create trigger agents_code_map after insert or update of erp_account_code on public.agents
  for each row execute function public.agents_code_map_trg();

create or replace view public.v_agent_codes as
  select acc.agent_id, acc.company_id, acc.erp_code, c.key_prefix || acc.erp_code as code
  from public.agent_company_codes acc join public.companies c on c.code = acc.company_id;

-- Distinctive part of a name for matching ("Shenzhen Lucky Logistics Co., Ltd" -> "SHENZHEN LUCKY").
-- Legal suffixes and industry words are dropped, or every "X Logistics" would look alike.
create or replace function public.agent_name_key(p text) returns text
language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9 ]', ' ', 'g'),
    '\m(CO|COMPANY|LTD|LIMITED|PTY|PVT|PRIVATE|INC|LLC|GMBH|SA|SAS|BV|CORP|CORPORATION|THE|P L|LOGISTICS?|FREIGHT|FORWARDING|FORWARDERS?|SHIPPING|GLOBAL|INTERNATIONAL|INTL|SERVICES?|GROUP|EXPRESS|CARGO|SUPPLY|CHAIN|TRANSPORT|LINES?|AGENCY|AGENCIES|WORLDWIDE|SOLUTIONS?|AND|OF)\M', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- Stored key + trigram index: the review queue finds similar agents by index, not by comparing every pair.
-- (To change agent_name_key later: drop this column, replace the function, add the column back.)
alter table public.agents add column if not exists name_key text generated always as (public.agent_name_key(name)) stored;
create index if not exists agents_name_key_trgm on public.agents using gin (name_key gin_trgm_ops);

-- ── 2. Views: join through v_agent_codes, add company ─────────────────────────────────────────
-- Existing columns keep their order and types; new columns go on the end.

create or replace view public.v_agent_jobs as
 WITH legs AS (
         SELECT a.id AS agent_id,
            ac.code AS agent_code,
            l.job_unique,
            min(l.job_no) AS job_no,
            min(l.house_bill) AS house_bill,
            min(l.direction) AS direction,
            min(l.mode) AS mode,
            min(l.load_type) AS load_type,
            min(l.origin) AS origin,
            min(l.destination) AS destination,
            min(l.customer_account_id) AS customer_account_id,
            min(COALESCE(l.etd, l.doc_date)) AS dt,
            max(l.weight_kg) AS weight_kg,
            min(ac.erp_code) AS bill_code,          -- charge lines carry the raw ERP code in bill_to
            min(l.company_id) AS company_id
           FROM public.agents a
             JOIN public.v_agent_codes ac ON ac.agent_id = a.id
             JOIN scoped.shipment_legs l ON l.os_agent_code = ac.code
          WHERE COALESCE(l.etd, l.doc_date) >= (CURRENT_DATE - 760)
            AND l.direction = ANY (ARRAY['import'::text, 'export'::text])
          GROUP BY a.id, ac.code, l.job_unique
        ), fc AS MATERIALIZED (   -- freight codes once per query (per-row calls made Performance take 50s)
         SELECT public.agent_freight_codes() AS codes
        ), ch AS (
         SELECT g_1.job_unique,
            count(*) FILTER (WHERE c.sell <> 0::numeric) AS lines,
            bool_or(c.sell <> 0::numeric AND c.charge_code = ANY (fc.codes) AND c.bill_to = g_1.bill_code) AS frt_agent,
            bool_or(c.sell <> 0::numeric AND c.charge_code = ANY (fc.codes) AND c.bill_to IS DISTINCT FROM g_1.bill_code) AS frt_other,
            sum(c.sell) FILTER (WHERE c.charge_code = ANY (fc.codes)) AS frt_sell,
            string_agg(DISTINCT c.bill_to, ', '::text) FILTER (WHERE c.sell <> 0::numeric AND c.charge_code = ANY (fc.codes)) AS frt_bill_to
           FROM legs g_1
             JOIN scoped.job_charges c ON c.job_unique = g_1.job_unique
             CROSS JOIN fc
          GROUP BY g_1.job_unique
        )
 SELECT g.agent_id,
    g.agent_code,
    g.job_unique,
    g.job_no,
    g.house_bill,
    g.direction,
    g.mode,
    g.load_type,
    g.origin,
    g.destination,
    g.customer_account_id,
    g.dt,
    g.weight_kg,
    COALESCE(ch.lines, 0::bigint) AS charge_lines,
    COALESCE(ch.frt_agent, false) AS frt_agent,
    COALESCE(ch.frt_other, false) AS frt_other,
    ch.frt_sell,
    ch.frt_bill_to,
        CASE
            WHEN COALESCE(ch.lines, 0::bigint) = 0 THEN 'unbilled'::text
            WHEN ch.frt_agent AND ch.frt_other THEN 'exception'::text
            WHEN ch.frt_other THEN 'nomination'::text
            WHEN ch.frt_agent THEN
            CASE WHEN g.direction = 'export'::text THEN 'freehand'::text ELSE 'exception'::text END
            ELSE
            CASE WHEN g.direction = 'import'::text THEN 'freehand'::text ELSE 'exception'::text END
        END AS auto_class,
    o.class AS override_class,
    g.company_id
   FROM legs g
     LEFT JOIN ch ON ch.job_unique = g.job_unique
     LEFT JOIN public.agent_job_overrides o ON o.job_unique = g.job_unique;

create or replace view public.v_agent_quotes as
 SELECT a.id AS for_agent_id,
    q.id, q.quote_no, q.status, q.shipment_mode, q.shipment_type, q.incoterms, q.incoterm_place,
    q.customer_account_id, q.customer_name, q.customer_po, q.shipper, q.consignee, q.movement_type,
    q.sales_executive_id, q.pricing_executive_id, q.request_received_from, q.product_type, q.project,
    q.origin_location_type, q.pickup_date, q.pickup_location, q.pickup_postal_code, q.pickup_address,
    q.dest_location_type, q.delivery_date, q.drop_location, q.drop_postal_code, q.drop_address,
    q.cargo_value, q.cargo_value_currency, q.need_insurance, q.need_refrigeration, q.is_hazardous,
    q.hazard_comments, q.created_by, q.created_at, q.updated_at, q.stackable, q.from_port_code,
    q.to_port_code, q.shipper_address, q.consignee_address, q.reefer_temp_c, q.dg_un_number, q.dg_class,
    q.shipping_line, q.service_type, q.internal_notes, q.external_notes, q.cargo_entry_mode, q.source,
    q.source_meta, q.agent_id, q.agent_name, q.freight_terms, q.booking_id, q.contact_name,
    q.contact_email, q.contact_phone, q.lost_reason, q.lost_note, q.lost_at, q.expires_at,
    q.last_reminded_at, q.sent_for_approval_at, q.ai_priced_at, q.ai_gaps, q.won_at,
    q.company_id
   FROM public.agents a
     JOIN scoped.quotes q ON q.agent_id = a.id
       OR (q.agent_id IS NULL AND q.customer_account_id IN
           (SELECT c.code FROM public.v_agent_codes c WHERE c.agent_id = a.id));

create or replace view public.v_agent_reciprocity as
 WITH ship AS (
         SELECT s.os_agent_code AS code, s.direction, s.mode, s.job_unique, s.company_id
           FROM scoped.shipments s
          WHERE s.os_agent_code IS NOT NULL AND btrim(s.os_agent_code) <> ''::text
        ), agg AS (
         SELECT sh.code,
            count(*) FILTER (WHERE sh.direction = 'import'::text) AS imp_jobs,
            count(*) FILTER (WHERE sh.direction = 'export'::text) AS exp_jobs,
            count(*) FILTER (WHERE sh.direction = 'import'::text AND sh.mode = 'sea'::text) AS imp_sea,
            count(*) FILTER (WHERE sh.direction = 'import'::text AND sh.mode = 'air'::text) AS imp_air,
            count(*) FILTER (WHERE sh.direction = 'export'::text AND sh.mode = 'sea'::text) AS exp_sea,
            count(*) FILTER (WHERE sh.direction = 'export'::text AND sh.mode = 'air'::text) AS exp_air,
            COALESCE(sum(f.revenue) FILTER (WHERE sh.direction = 'import'::text), 0::numeric) AS imp_revenue,
            COALESCE(sum(f.revenue) FILTER (WHERE sh.direction = 'export'::text), 0::numeric) AS exp_revenue,
            COALESCE(sum(f.gross_profit) FILTER (WHERE sh.direction = 'import'::text), 0::numeric) AS imp_gp,
            COALESCE(sum(f.gross_profit) FILTER (WHERE sh.direction = 'export'::text), 0::numeric) AS exp_gp,
            min(sh.company_id) AS company_id
           FROM ship sh
             LEFT JOIN reporting.mv_job_financials f ON f.job_unique = sh.job_unique
          GROUP BY sh.code
        ), nets AS (
         SELECT an.agent_id, string_agg(fn.code, ', '::text ORDER BY fn.code) AS networks
           FROM public.agent_networks an
             JOIN public.freight_networks fn ON fn.id = an.network_id
          GROUP BY an.agent_id
        )
 SELECT g.code,
        CASE WHEN a.id IS NOT NULL THEN 'third_party'::text ELSE COALESCE(e.reason, 'uncurated'::text) END AS band,
    COALESCE(a.name, e.name, r.name, cu.name) AS name,
    COALESCE(r.country, cu.country) AS country,
    n.networks,
    a.trusted,
    g.imp_jobs + g.exp_jobs AS total_jobs,
    g.imp_jobs, g.exp_jobs, g.imp_sea, g.imp_air, g.exp_sea, g.exp_air,
    g.exp_jobs - g.imp_jobs AS balance,
    round(g.imp_revenue)::bigint AS imp_revenue,
    round(g.exp_revenue)::bigint AS exp_revenue,
    round(g.imp_gp)::bigint AS imp_gp,
    round(g.exp_gp)::bigint AS exp_gp,
    g.company_id,
    a.id AS agent_id
   FROM agg g
     LEFT JOIN public.v_agent_codes ac ON ac.code = g.code
     LEFT JOIN public.agents a ON a.id = ac.agent_id
     LEFT JOIN nets n ON n.agent_id = a.id
     LEFT JOIN public.os_agent_exclusions e ON e.code = g.code
     LEFT JOIN scoped.erp_account_ref r ON r.account_id = g.code
     LEFT JOIN scoped.customers cu ON cu.account_id = g.code;

create or replace view public.v_agent_reconciliation as
 WITH base AS (
         SELECT s.os_agent_code AS code,
            count(*)::integer AS jobs,
            count(*) FILTER (WHERE s.direction = 'import'::text)::integer AS imp,
            count(*) FILTER (WHERE s.direction = 'export'::text)::integer AS exp,
            min(s.company_id) AS company_id
           FROM scoped.shipments s
          WHERE s.os_agent_code IS NOT NULL AND btrim(s.os_agent_code) <> ''::text
          GROUP BY s.os_agent_code
        )
 SELECT b.code, COALESCE(r.name, c.name) AS name, COALESCE(r.country, c.country) AS country, r.salesarea, b.jobs, b.imp, b.exp,
    ac.code IS NOT NULL AS in_directory,
    c.account_id IS NOT NULL AS is_customer,
    upper(coalesce(ac.erp_code, (public.agent_code_split(b.code)).erp_code)) ~~ 'UB%'::text AS own_network_guess,
        CASE
            WHEN ac.code IS NOT NULL THEN '1_in_directory'::text
            WHEN upper((public.agent_code_split(b.code)).erp_code) ~~ 'UB%'::text THEN '2_own_network'::text
            WHEN c.account_id IS NOT NULL THEN '3_is_customer'::text
            ELSE '4_unmatched_candidate'::text
        END AS band,
    b.company_id
   FROM base b
     LEFT JOIN scoped.erp_account_ref r ON r.account_id = b.code
     LEFT JOIN public.v_agent_codes ac ON ac.code = b.code
     LEFT JOIN scoped.customers c ON c.account_id = b.code;

-- Review queue: codes on jobs that are neither linked to an agent nor excluded, with a suggestion.
create or replace view public.v_agent_review_queue as
 WITH v AS (
         SELECT s.os_agent_code AS code,
            count(*) AS jobs,
            count(*) FILTER (WHERE s.direction = 'import'::text) AS imp,
            count(*) FILTER (WHERE s.direction = 'export'::text) AS exp,
            max(s.relevant_date) AS last_activity,
            min(s.company_id) AS company_id
           FROM scoped.shipments s
          WHERE s.os_agent_code IS NOT NULL AND btrim(s.os_agent_code) <> ''::text
          GROUP BY s.os_agent_code
        ), q AS (
         SELECT v.*, COALESCE(r.name, cu.name) AS name, COALESCE(r.country, cu.country) AS country,
                (public.agent_code_split(v.code)).erp_code AS raw_code,
                public.agent_name_key(COALESCE(r.name, cu.name)) AS name_key
           FROM v
             LEFT JOIN public.erp_account_ref r ON r.account_id = v.code
             LEFT JOIN public.customers cu ON cu.account_id = v.code
          WHERE NOT EXISTS (SELECT 1 FROM public.v_agent_codes ac WHERE ac.code = v.code)
            AND NOT EXISTS (SELECT 1 FROM public.os_agent_exclusions x WHERE x.code = v.code)
        )
 SELECT q.code, q.name, q.country, q.jobs, q.imp, q.exp, q.last_activity,
        CASE
            WHEN upper(q.raw_code) ~~ 'UB%'::text AND q.name ~* '^(UB|U\.B\.)[ .]'::text THEN 'own_office'::text
            WHEN q.name ~* '(AIRWAYS|AIRLINE|FORUM LINE|COSCO|MAERSK|MSC |CONTAINER LINE)'::text THEN 'carrier'::text
            WHEN q.name ~* '(HARDWARE|INDUSTR|TRADING|CONSTRUCTION|PRODUCTS|MANUFACTUR|STATIONERY|ENTERPRISE)'::text THEN 'customer'::text
            WHEN q.name ~* '(LOGISTIC|FREIGHT|FORWARD|SHIPPING|CARGO|AGENC|TRANSPORT|SUPPLY CHAIN|EXPRESS|GLOBAL|INTERNATIONAL)'::text THEN 'agent'::text
            ELSE 'unknown'::text
        END AS suggested_class,
    q.company_id,
    q.raw_code,
    sg.agent_id AS suggested_agent_id,
    sg.name AS suggested_agent_name,
    sg.reason AS suggest_reason
   FROM q
     LEFT JOIN LATERAL (
         SELECT x.agent_id, x.name, x.reason FROM (
             SELECT acc.agent_id, a.name, 'Same code in ' || acc.company_id AS reason, 2.0::real AS score
               FROM public.agent_company_codes acc JOIN public.agents a ON a.id = acc.agent_id
              WHERE acc.erp_code = q.raw_code AND acc.company_id <> q.company_id
             UNION ALL
             SELECT a.id, a.name, 'Similar name', similarity(a.name_key, q.name_key)
               FROM public.agents a
              WHERE length(q.name_key) >= 3 AND a.name_key % q.name_key
                AND similarity(a.name_key, q.name_key) >= 0.7
         ) x ORDER BY x.score DESC LIMIT 1) sg ON true;

create or replace view public.v_agents_directory as
 SELECT a.id, a.erp_account_code, a.name, a.country, a.source, a.status, a.trusted, a.approved_by,
    a.approved_at, a.notes, a.created_at, a.updated_at,
    la.last_activity,
    COALESCE(la.job_count, 0::bigint) AS job_count,
    COALESCE(qs.quotes, 0) AS quotes_12m,
    COALESCE(qs.won, 0) AS won_12m,
    COALESCE(qs.lost, 0) AS lost_12m,
    qs.hrs_to_win, qs.top_lane, qs.last_quote,
    COALESCE(st.state, 'none'::text) AS agreement_state,
    st.expiry_date AS agreement_expiry,
    st.days_left AS agreement_days_left,
    COALESCE(bk.freehand, 0) AS freehand_12m,
    COALESCE(bk.booked, 0) AS booked_12m,
    la.jobs_by_company,
    (SELECT array_agg(ac.code ORDER BY ac.company_id, ac.code) FROM public.v_agent_codes ac WHERE ac.agent_id = a.id) AS codes
   FROM public.agents a
     LEFT JOIN LATERAL (
         SELECT max(z.last) AS last_activity, sum(z.n)::bigint AS job_count,
                jsonb_object_agg(z.company_id, z.n) AS jobs_by_company
           FROM (SELECT s.company_id, max(s.relevant_date) AS last, count(*) AS n
                   FROM scoped.shipments s JOIN public.v_agent_codes ac ON ac.code = s.os_agent_code
                  WHERE ac.agent_id = a.id
                  GROUP BY s.company_id) z) la ON true
     LEFT JOIN LATERAL (
         SELECT count(*)::integer AS quotes,
            count(*) FILTER (WHERE q.status = ANY (ARRAY['won'::text, 'crosswin'::text]))::integer AS won,
            count(*) FILTER (WHERE q.status = 'lost'::text)::integer AS lost,
            round((percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY ((EXTRACT(epoch FROM q.won_at - q.created_at) / 3600.0))::double precision) FILTER (WHERE q.won_at IS NOT NULL))::numeric, 1) AS hrs_to_win,
            mode() WITHIN GROUP (ORDER BY ((COALESCE(q.from_port_code, '?'::text) || ' > '::text) || COALESCE(q.to_port_code, '?'::text))) AS top_lane,
            max(q.created_at) AS last_quote
           FROM public.v_agent_quotes q
          WHERE q.for_agent_id = a.id AND q.created_at >= (now() - '1 year'::interval)) qs ON true
     LEFT JOIN public.v_agent_agreement_state st ON st.agent_id = a.id
     LEFT JOIN public.v_agent_bookings_12m bk ON bk.agent_id = a.id;

-- ── 3. Stats functions: all codes of the agent, plus a company split ─────────────────────────

create or replace function public.agent_stats(p_agent uuid, p_months integer default 12)
returns jsonb language sql stable set search_path = public as $$
  with a as (select * from agents where id = p_agent),
  q as (select * from v_agent_quotes where for_agent_id = p_agent and created_at >= now() - make_interval(months => p_months)),
  team as (select round(100.0 * count(*) filter (where status in ('won','crosswin')) / nullif(count(*), 0), 0) c
           from quotes where created_at >= now() - make_interval(months => p_months)),
  shp as (select l.* from shipment_legs l join v_agent_codes ac on ac.code = l.os_agent_code
          where ac.agent_id = p_agent and coalesce(l.etd, l.doc_date) >= current_date - (p_months * 30)),
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
    'by_company', coalesce((select jsonb_agg(x order by x.shipments desc, x.quotes desc) from (
        select co as company, sum(s)::int as shipments, round(sum(kg)) as kg, sum(qn)::int as quotes, sum(w)::int as won from (
          select company_id co, count(*) s, sum(coalesce(weight_kg, 0)) kg, 0 qn, 0 w from shp group by 1
          union all
          select company_id, 0, 0, count(*), count(*) filter (where status in ('won','crosswin')) from q group by 1) u
        group by co) x), '[]'::jsonb),
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

create or replace function public.agents_overview(p_months integer default 12)
returns jsonb language sql stable set search_path = public as $$
  with q as (
    select * from v_agent_quotes where created_at >= now() - make_interval(months => p_months)
  ), prior as (
    select count(*) n from v_agent_quotes
    where created_at < now() - make_interval(months => p_months)
      and created_at >= now() - make_interval(months => p_months * 2)
  ), shl as (
    select l.company_id, l.weight_kg
    from shipment_legs l join v_agent_codes ac on ac.code = l.os_agent_code
    where coalesce(l.etd, l.doc_date) >= current_date - 365
  ), shp as (
    select count(*) n, round(sum(coalesce(weight_kg, 0))) kg from shl
  ), st as (select * from v_agent_agreement_state)
  select jsonb_build_object(
    'quotes', (select count(*) from q),
    'prior_quotes', (select n from prior),
    'won', (select count(*) filter (where status in ('won','crosswin')) from q),
    'lost', (select count(*) filter (where status = 'lost') from q),
    'active_agents', (select count(distinct for_agent_id) from q),
    'hrs_to_win', (select round((percentile_cont(0.5) within group (order by extract(epoch from won_at - created_at) / 3600.0))::numeric, 1) from q where won_at is not null),
    'shipments', (select n from shp), 'shipment_kg', (select kg from shp),
    'by_company', coalesce((select jsonb_agg(x order by x.shipments desc, x.quotes desc) from (
        select co as company, sum(s)::int as shipments, round(sum(kg)) as kg, sum(qn)::int as quotes, sum(w)::int as won from (
          select company_id co, count(*) s, sum(coalesce(weight_kg, 0)) kg, 0 qn, 0 w from shl group by 1
          union all
          select company_id, 0, 0, count(*), count(*) filter (where status in ('won','crosswin')) from q group by 1) u
        group by co) x), '[]'::jsonb),
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

create or replace function public.agents_network_stats(p_months integer default 12)
returns jsonb language sql stable set search_path = public as $$
  with an as (
    select a.id as agent_id, a.erp_account_code,
           coalesce(n.code, 'NONE') as code, coalesce(n.name, 'No network') as name,
           coalesce(n.sort_order, 9999) as sort_order
    from agents a
    left join agent_networks x on x.agent_id = a.id
    left join freight_networks n on n.id = x.network_id
  ),
  q as (
    select q.for_agent_id as agent_id,
      count(*)::int as quotes,
      count(*) filter (where q.status in ('won','crosswin'))::int as won,
      count(*) filter (where q.status = 'lost')::int as lost
    from v_agent_quotes q
    where q.created_at >= now() - make_interval(months => p_months)
    group by 1
  ),
  b as (
    select ac.agent_id,
      count(*) filter (where l.direction = 'import')::int as freehand,
      count(*) filter (where l.direction = 'export')::int as nomination,
      coalesce(round(sum(f.gross_profit) filter (where l.direction = 'import')), 0) as freehand_gp,
      coalesce(round(sum(f.gross_profit) filter (where l.direction = 'export')), 0) as nomination_gp
    from v_agent_codes ac
    join shipment_legs l on l.os_agent_code = ac.code
    left join reporting.mv_job_financials f on f.job_unique = l.job_unique
    where coalesce(l.etd, l.doc_date) >= current_date - make_interval(months => p_months)
    group by 1
  ),
  per_agent as (
    select a.id as agent_id,
      coalesce(q.quotes, 0) quotes, coalesce(q.won, 0) won, coalesce(q.lost, 0) lost,
      coalesce(b.freehand, 0) freehand, coalesce(b.nomination, 0) nomination,
      coalesce(b.freehand_gp, 0) freehand_gp, coalesce(b.nomination_gp, 0) nomination_gp
    from agents a left join q on q.agent_id = a.id left join b on b.agent_id = a.id
  ),
  agg as (
    select an.code, an.name, an.sort_order,
      count(distinct an.agent_id)::int as agents,
      count(distinct an.agent_id) filter (where p.quotes + p.freehand + p.nomination > 0)::int as active_agents,
      sum(p.quotes)::int quotes, sum(p.won)::int won, sum(p.lost)::int lost,
      sum(p.freehand)::int freehand, sum(p.freehand_gp) freehand_gp,
      sum(p.nomination)::int nomination, sum(p.nomination_gp) nomination_gp,
      count(distinct an.agent_id) filter (where p.freehand > 0 and p.nomination > 0)::int as two_way_agents
    from an join per_agent p on p.agent_id = an.agent_id
    group by 1, 2, 3
  ),
  tot as (
    select count(*)::int agents,
      count(*) filter (where quotes + freehand + nomination > 0)::int active_agents,
      sum(quotes)::int quotes, sum(won)::int won, sum(lost)::int lost,
      sum(freehand)::int freehand, sum(freehand_gp) freehand_gp,
      sum(nomination)::int nomination, sum(nomination_gp) nomination_gp,
      count(*) filter (where freehand > 0 and nomination > 0)::int two_way_agents
    from per_agent
  )
  select jsonb_build_object(
    'months', p_months,
    'networks', coalesce((select jsonb_agg(to_jsonb(agg) - 'sort_order'
        order by (agg.code = 'NONE'), agg.freehand + agg.nomination + agg.quotes desc, agg.sort_order) from agg), '[]'::jsonb),
    'total', (select to_jsonb(tot) from tot))
$$;

create or replace function public.agent_shipment_stats(p_code text)
returns jsonb language sql stable set search_path = public as $$
  with codes as (
    select c2.code from v_agent_codes c1 join v_agent_codes c2 on c2.agent_id = c1.agent_id where c1.code = p_code
    union select p_code
  ),
  s as (select sh.* from shipments sh where sh.os_agent_code in (select code from codes)),
  y as (select * from s where coalesce(etd, relevant_date) >= current_date - 365)
  select jsonb_build_object(
    'total', (select count(*) from s),
    'last_12m', (select count(*) from y),
    'in_transit', (select count(*) from s where status = 'In transit'),
    'upcoming', (select count(*) from s where status in ('Booked','Scheduled')),
    'imports', (select count(*) from y where direction = 'import'),
    'exports', (select count(*) from y where direction = 'export'),
    'air', (select count(*) from y where mode = 'air'),
    'sea', (select count(*) from y where mode = 'sea'),
    'fcl', (select count(*) from y where mode = 'sea' and load_type ilike 'fcl%'),
    'lcl', (select count(*) from y where mode = 'sea' and load_type ilike 'lcl%'),
    'weight_kg', (select round(sum(coalesce(weight_kg, 0))) from y),
    'volume_m3', (select round(sum(coalesce(volume_m3, 0))::numeric, 1) from y),
    'gp', (select round(sum(f.gross_profit)) from y join reporting.mv_job_financials f on f.job_unique = y.job_unique),
    'revenue', (select round(sum(f.revenue)) from y join reporting.mv_job_financials f on f.job_unique = y.job_unique),
    'last_shipment', (select max(coalesce(etd, relevant_date)) from s),
    'by_company', coalesce((select jsonb_agg(x order by x.last_12m desc, x.total desc) from (
        select s.company_id as company, count(*)::int as total,
               count(*) filter (where coalesce(s.etd, s.relevant_date) >= current_date - 365)::int as last_12m,
               count(*) filter (where coalesce(s.etd, s.relevant_date) >= current_date - 365 and s.direction = 'import')::int as imports,
               count(*) filter (where coalesce(s.etd, s.relevant_date) >= current_date - 365 and s.direction = 'export')::int as exports
        from s group by 1) x), '[]'::jsonb),
    'lanes', coalesce((select jsonb_agg(x order by x.n desc) from (
       select origin || ' > ' || destination lane, count(*) n from y
       where origin is not null and destination is not null group by 1 order by 2 desc limit 3) x), '[]'::jsonb)
  )
$$;

create or replace function public.get_agent_brief(p_agent_id uuid)
returns jsonb language plpgsql stable security definer set search_path = scoped, public as $$
declare
  v_code text;
  v_codes text[];
  v_result jsonb;
begin
  if not is_staff() then
    raise exception 'not authorised';
  end if;

  select erp_account_code into v_code from public.agents where id = p_agent_id;
  select array_agg(ac.code) into v_codes from public.v_agent_codes ac where ac.agent_id = p_agent_id;

  if v_codes is null then
    -- portal-only agent with no ERP link: nothing to aggregate
    return jsonb_build_object(
      'linked', false, 'shipments_total', 0, 'shipments_12m', 0, 'revenue_total', 0, 'gp_total', 0,
      'unpaid_count', 0, 'unpaid_balance', 0, 'last_shipment', null,
      'recent_lanes', '[]'::jsonb, 'unpaid_invoices', '[]'::jsonb, 'by_company', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'linked', true,
    'erp_account_code', v_code,
    'codes', to_jsonb(v_codes),
    'shipments_total', (select count(*) from shipments s where s.os_agent_code = any (v_codes)),
    'shipments_12m', (select count(*) from shipments s where s.os_agent_code = any (v_codes) and s.etd >= (now() - interval '12 months')),
    'revenue_total', (select round(coalesce(sum(f.revenue),0),0) from shipments s join v_job_financials f on f.job_unique = s.job_unique where s.os_agent_code = any (v_codes)),
    'gp_total', (select round(coalesce(sum(f.gross_profit),0),0) from shipments s join v_job_financials f on f.job_unique = s.job_unique where s.os_agent_code = any (v_codes)),
    'unpaid_count', (select count(*) from invoices i where i.account_id = any (v_codes) and coalesce(i.balance,0) > 0),
    'unpaid_balance', (select round(coalesce(sum(i.balance),0),0) from invoices i where i.account_id = any (v_codes) and coalesce(i.balance,0) > 0),
    'last_shipment', (select max(s.etd) from shipments s where s.os_agent_code = any (v_codes)),
    'by_company', coalesce((select jsonb_agg(x order by x.shipments_12m desc, x.shipments_total desc) from (
        select s.company_id as company, count(*)::int as shipments_total,
               count(*) filter (where s.etd >= (now() - interval '12 months'))::int as shipments_12m
        from shipments s where s.os_agent_code = any (v_codes) group by 1) x), '[]'::jsonb),
    'recent_lanes', coalesce((
      select jsonb_agg(l) from (
        select s.origin, s.destination, s.mode, s.direction, count(*) as shipments, max(s.etd) as last_etd
        from shipments s where s.os_agent_code = any (v_codes)
        group by s.origin, s.destination, s.mode, s.direction
        order by count(*) desc limit 5
      ) l), '[]'::jsonb),
    'unpaid_invoices', coalesce((
      select jsonb_agg(iv) from (
        select i.invoice_no, i.balance, i.currency, i.company_id
        from invoices i where i.account_id = any (v_codes) and coalesce(i.balance,0) > 0
        order by i.balance desc limit 5
      ) iv), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

create or replace function public.agents_performance(p_months integer)
returns jsonb language sql stable security definer set search_path = scoped, public, reporting as $$
  with p as (select greatest(1, least(coalesce(p_months, 12), 24)) as m),
  since as (select (current_date - make_interval(months => (select m from p)))::date as d,
                   (current_date - make_interval(months => (select m from p) * 2))::date as d_prior),
  lastj as (
    select ac.agent_id, max(coalesce(l.etd, l.doc_date)) as last_job
    from public.v_agent_codes ac join shipment_legs l on l.os_agent_code = ac.code
    group by ac.agent_id
  ),
  jf as materialized (   -- computed once (inlining it re-ran v_agent_jobs per agent: 50s)
    select j.agent_id, j.job_unique, j.dt, j.company_id, agent_job_final(j.auto_class, j.override_class) as cls, f.gross_profit as gp
    from v_agent_jobs j left join reporting.mv_job_financials f on f.job_unique = j.job_unique
  ),
  per as (
    select a.id as agent_id,
      count(*) filter (where jf.cls = 'freehand' and jf.dt >= since.d) as fh,
      count(*) filter (where jf.cls = 'nomination' and jf.dt >= since.d) as nom,
      coalesce(sum(jf.gp) filter (where jf.cls = 'freehand' and jf.dt >= since.d), 0) as fh_gp,
      coalesce(sum(jf.gp) filter (where jf.cls = 'nomination' and jf.dt >= since.d), 0) as nom_gp,
      count(*) filter (where jf.cls = 'freehand' and jf.dt >= since.d_prior and jf.dt < since.d) as fh_prior,
      count(*) filter (where jf.cls = 'nomination' and jf.dt >= since.d_prior and jf.dt < since.d) as nom_prior,
      count(*) filter (where jf.cls = 'exception' and jf.dt >= since.d) as exc,
      count(*) filter (where jf.cls = 'unbilled' and jf.dt >= since.d) as unbilled,
      max(jf.dt) filter (where jf.cls = 'freehand') as last_fh,
      max(jf.dt) filter (where jf.cls = 'nomination') as last_nom,
      count(*) filter (where jf.cls <> 'excluded' and jf.dt >= current_date - 365) as jobs_12m,
      count(*) filter (where jf.cls <> 'excluded' and jf.dt < current_date - 365 and jf.dt >= current_date - 730) as jobs_prev_12m,
      array_agg(distinct jf.company_id order by jf.company_id)
        filter (where jf.company_id is not null and jf.dt >= since.d and jf.cls in ('freehand', 'nomination')) as companies
    from agents a cross join since left join jf on jf.agent_id = a.id
    group by a.id
  ),
  q as (
    select for_agent_id as agent_id,
      count(*) filter (where created_at >= since.d) as quotes,
      count(*) filter (where created_at >= since.d and status in ('won', 'crosswin')) as won,
      count(*) filter (where created_at >= since.d and status = 'lost') as lost,
      count(*) filter (where created_at >= since.d_prior and created_at < since.d) as quotes_prior,
      max(created_at)::date as last_quote
    from v_agent_quotes cross join since
    where for_agent_id is not null
    group by for_agent_id
  ),
  net as (select an.agent_id, fn.code from agent_networks an join freight_networks fn on fn.id = an.network_id),
  ar as (
    select a.id, a.name, a.country, a.status,
      coalesce((select array_agg(code order by code) from net where net.agent_id = a.id), '{}') as networks,
      coalesce(per.fh, 0) fh, coalesce(per.nom, 0) nom, round(coalesce(per.fh_gp, 0)) fh_gp, round(coalesce(per.nom_gp, 0)) nom_gp,
      coalesce(per.fh_prior, 0) fh_prior, coalesce(per.nom_prior, 0) nom_prior,
      per.last_fh, per.last_nom, coalesce(per.exc, 0) exc, coalesce(per.unbilled, 0) unbilled, coalesce(per.jobs_12m, 0) jobs_12m, coalesce(per.jobs_prev_12m, 0) jobs_prev_12m,
      coalesce(per.companies, '{}') companies,
      coalesce(q.quotes, 0) quotes, coalesce(q.won, 0) won, coalesce(q.lost, 0) lost, coalesce(q.quotes_prior, 0) quotes_prior, q.last_quote,
      greatest(lj.last_job::date, q.last_quote) as last_any
    from agents a left join per on per.agent_id = a.id left join q on q.agent_id = a.id left join lastj lj on lj.agent_id = a.id
    where coalesce(a.status, 'active') <> 'archived'
  ),
  co as (   -- company split of the period
    select company, sum(fh)::int fh, sum(nom)::int nom, round(sum(fh_gp)) fh_gp, round(sum(nom_gp)) nom_gp,
           sum(quotes)::int quotes, sum(won)::int won, count(distinct agent_id) filter (where fh + nom > 0)::int agents
    from (
      select jf.company_id company, jf.agent_id,
        count(*) filter (where jf.cls = 'freehand') fh, count(*) filter (where jf.cls = 'nomination') nom,
        coalesce(sum(jf.gp) filter (where jf.cls = 'freehand'), 0) fh_gp, coalesce(sum(jf.gp) filter (where jf.cls = 'nomination'), 0) nom_gp,
        0 quotes, 0 won
      from jf cross join since where jf.dt >= since.d group by 1, 2
      union all
      select vq.company_id, vq.for_agent_id, 0, 0, 0, 0, count(*), count(*) filter (where vq.status in ('won', 'crosswin'))
      from v_agent_quotes vq cross join since where vq.created_at >= since.d and vq.for_agent_id is not null group by 1, 2
    ) u where company is not null group by company
  )
  select jsonb_build_object(
    'months', (select m from p),
    'since', (select d from since),
    'kpis', (select jsonb_build_object(
        'quotes', sum(quotes), 'won', sum(won), 'lost', sum(lost), 'quotes_prior', sum(quotes_prior),
        'freehand', sum(fh), 'freehand_prior', sum(fh_prior), 'freehand_gp', sum(fh_gp),
        'nominations', sum(nom), 'nominations_prior', sum(nom_prior), 'nominations_gp', sum(nom_gp),
        'freehand_agents', count(*) filter (where fh > 0), 'nomination_agents', count(*) filter (where nom > 0),
        'reciprocal_agents', count(*) filter (where fh > 0 and nom > 0),
        'quoting_agents', count(*) filter (where quotes > 0),
        'exceptions', sum(exc), 'unbilled', sum(unbilled)) from ar),
    'by_company', coalesce((select jsonb_agg(to_jsonb(co) order by co.fh + co.nom desc, co.quotes desc) from co), '[]'::jsonb),
    'networks', coalesce((select jsonb_agg(x order by x.fh + x.nom desc, x.quotes desc) from (
        select coalesce(n.code, 'No network') as network, count(distinct r.id) agents,
          count(distinct r.id) filter (where r.fh > 0 or r.nom > 0 or r.quotes > 0) active_agents,
          sum(r.quotes) quotes, sum(r.won) won, sum(r.lost) lost,
          sum(r.fh) fh, sum(r.fh_gp) fh_gp, sum(r.nom) nom, sum(r.nom_gp) nom_gp,
          count(distinct r.id) filter (where r.fh > 0 and r.nom > 0) reciprocal,
          sum(r.fh_prior) fh_prior, sum(r.nom_prior) nom_prior, sum(r.exc) exc, sum(r.unbilled) unbilled
        from ar r left join net n on n.agent_id = r.id
        group by coalesce(n.code, 'No network')) x), '[]'::jsonb),
    'reciprocal', coalesce((select jsonb_agg(x order by x.fh + x.nom desc) from (
        select id, name, country, networks, companies, fh, fh_gp, nom, nom_gp, quotes, won, last_any
        from ar where fh > 0 and nom > 0 order by fh + nom desc limit 60) x), '[]'::jsonb),
    'one_way', (select jsonb_build_object(
        'freehand_only', count(*) filter (where fh > 0 and nom = 0),
        'nomination_only', count(*) filter (where nom > 0 and fh = 0)) from ar),
    'aging', coalesce((select jsonb_agg(x order by x.prior_jobs desc, x.days_idle desc) from (
        select id, name, country, networks, companies, last_fh, last_nom, last_quote, last_any,
          (current_date - last_any) as days_idle, jobs_12m, jobs_prev_12m as prior_jobs,
          case when last_any is null then 'never'
               when current_date - last_any > 365 then 'inactive'
               when current_date - last_any > 180 then 'dormant'
               when current_date - last_any > 90 then 'cooling' else 'slipping' end as bucket
        from ar
        where (last_any is not null and current_date - last_any > 90)
           or (jobs_prev_12m > 0 and jobs_12m * 2 < jobs_prev_12m)
        order by jobs_prev_12m desc limit 80) x), '[]'::jsonb),
    'buckets', (select jsonb_build_object(
        'active', count(*) filter (where last_any >= current_date - 90),
        'cooling', count(*) filter (where last_any < current_date - 90 and last_any >= current_date - 180),
        'dormant', count(*) filter (where last_any < current_date - 180 and last_any >= current_date - 365),
        'inactive', count(*) filter (where last_any < current_date - 365),
        'never', count(*) filter (where last_any is null),
        'slipping', count(*) filter (where jobs_prev_12m >= 4 and jobs_12m * 2 < jobs_prev_12m)) from ar)
  )
  where is_staff()
$$;

create or replace function public.quotes_leaderboard_agents(p_period text default 'month', p_mode text default 'all')
returns jsonb language plpgsql stable security definer set search_path = scoped, public as $$
declare
  v_since timestamptz;
  v_out jsonb;
begin
  if not is_staff() then raise exception 'not allowed'; end if;
  v_since := date_trunc(case when p_period in ('week','month','quarter','year') then p_period else 'month' end,
             now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';

  with q as (
    select x.id, x.status, x.created_at, x.won_at,
           coalesce(a.id, ac.id) as agent_id,
           coalesce(a.name, ac.name, nullif(trim(x.agent_name), ''), x.customer_name, 'Unknown') as agent_name,
           upper(coalesce(a.country, ac.country, '')) as country,
           upper(coalesce(nullif(x.from_port_code, ''), '?')) as origin_code,
           upper(coalesce(nullif(x.to_port_code, ''), '?')) as dest_code,
           (select max(l.created_at) from quote_responses r join quote_response_lines l on l.response_id = r.id
             where r.quote_id = x.id) as rates_done
    from quotes x
    left join agents a on a.id = x.agent_id
    left join lateral (select a2.id, a2.name, a2.country from public.v_agent_codes vc join agents a2 on a2.id = vc.agent_id
                       where x.agent_id is null and vc.code = x.customer_account_id limit 1) ac on true
    where x.created_at >= v_since
      and (a.id is not null or ac.id is not null or nullif(trim(x.agent_name), '') is not null)
      and (coalesce(p_mode,'all') = 'all'
        or (p_mode = 'air' and (x.shipment_type ilike 'air' or x.shipment_mode ilike '%air%'))
        or (p_mode = 'fcl' and x.shipment_type ilike 'fcl')
        or (p_mode = 'lcl' and x.shipment_type ilike 'lcl'))
  ), ql as (
    select q.*,
           coalesce((select upper(p.country_code) from ports p where p.code = q.origin_code limit 1), '??') as o_cc,
           coalesce((select upper(p.country_code) from ports p where p.code = q.dest_code limit 1), '??') as d_cc
    from q
  ), g as (
    select coalesce(agent_id::text, 'n:' || lower(agent_name)) as k,
      max(agent_id::text) as agent_id,
      min(agent_name) as name,
      max(nullif(country, '')) as country,
      count(*)::int as quotes,
      count(*) filter (where status = 'open')::int as open,
      count(*) filter (where status = 'held')::int as held,
      count(*) filter (where status in ('won','crosswin'))::int as won,
      count(*) filter (where status = 'lost')::int as lost,
      round(100.0 * count(*) filter (where status in ('won','crosswin'))
        / nullif(count(*) filter (where status in ('won','crosswin','lost')), 0), 0) as win_rate,
      round((percentile_cont(0.5) within group (order by extract(epoch from rates_done - created_at) / 3600.0))::numeric, 1) as avg_hrs_to_quote,
      mode() within group (order by o_cc || '>' || d_cc) as top_lane,
      round((percentile_cont(0.5) within group (order by extract(epoch from won_at - created_at) / 3600.0) filter (where won_at is not null))::numeric, 1) as hrs_to_win,
      max(created_at) as last_quote
    from ql group by 1
  )
  select coalesce(jsonb_agg(to_jsonb(g) - 'k' order by g.quotes desc, g.won desc), '[]'::jsonb)
    into v_out from g;
  return v_out;
end $$;

create or replace function public.agents_bookings_overview()
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'freehand', coalesce(sum(freehand), 0), 'booked', coalesce(sum(booked), 0),
    'freehand_gp', coalesce(sum(freehand_gp), 0), 'booked_gp', coalesce(sum(booked_gp), 0),
    'freehand_agents', count(*) filter (where freehand > 0), 'booked_agents', count(*) filter (where booked > 0),
    'two_way_agents', count(*) filter (where freehand > 0 and booked > 0),
    'by_company', coalesce((select jsonb_agg(x order by x.freehand + x.booked desc) from (
        select j.company_id as company,
               count(*) filter (where agent_job_final(j.auto_class, j.override_class) = 'freehand')::int as freehand,
               count(*) filter (where agent_job_final(j.auto_class, j.override_class) = 'nomination')::int as booked
        from v_agent_jobs j where j.dt >= current_date - 365 and j.company_id is not null
        group by 1) x), '[]'::jsonb))
  from v_agent_bookings_12m
$$;

-- ── 4. Review queue actions ──────────────────────────────────────────────────────────────────

-- New agent from a code (any company). The trigger records the code against the new agent.
create or replace function public.agent_review_accept(p_code text, p_network_code text default null, p_name text default null)
returns uuid language plpgsql security definer set search_path = scoped, public as $$
declare v_name text; v_country text; v_id uuid;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  select coalesce(p_name, name), country into v_name, v_country from public.erp_account_ref where account_id = p_code;
  if v_name is null then
    select coalesce(p_name, name), country into v_name, v_country from public.customers where account_id = p_code;
  end if;
  v_name := coalesce(v_name, p_name);
  if v_name is null then raise exception 'name required for %', p_code; end if;
  delete from public.os_agent_exclusions where code = p_code;
  insert into public.agents (erp_account_code, name, country, source, approved_by, approved_at, notes)
  values (p_code, v_name, v_country, 'erp', auth.uid(), now(), 'Accepted via review')
  on conflict (erp_account_code) do nothing;
  select id into v_id from public.agents where erp_account_code = p_code;
  if p_network_code is not null and v_id is not null then
    insert into public.agent_networks (agent_id, network_id)
    select v_id, fn.id from public.freight_networks fn where fn.code = p_network_code
    on conflict do nothing;
  end if;
  return v_id;
end $$;

-- Link a code to an existing agent (eg FJ:LLL -> Lucky Logistics). Re-linking moves it.
create or replace function public.agent_review_link(p_code text, p_agent_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  if not exists (select 1 from public.agents where id = p_agent_id) then raise exception 'agent not found'; end if;
  select * into s from public.agent_code_split(p_code);
  delete from public.os_agent_exclusions where code = p_code;
  insert into public.agent_company_codes (agent_id, company_id, erp_code)
  values (p_agent_id, s.company_id, s.erp_code)
  on conflict (company_id, erp_code) do update set agent_id = excluded.agent_id;
  return p_agent_id;
end $$;

-- Detach a code. The agent is removed only when this was its last code and it was created from it.
create or replace function public.agent_code_detach(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_agent uuid;
begin
  select * into s from public.agent_code_split(p_code);
  delete from public.agent_company_codes where company_id = s.company_id and erp_code = s.erp_code
  returning agent_id into v_agent;
  if v_agent is not null and not exists (select 1 from public.agent_company_codes where agent_id = v_agent) then
    delete from public.agents where id = v_agent and erp_account_code = p_code;
  end if;
end $$;
revoke execute on function public.agent_code_detach(text) from public, anon, authenticated;

create or replace function public.agent_review_exclude(p_code text, p_reason text)
returns void language plpgsql security definer set search_path = scoped, public as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  p_reason := replace(p_reason, ' ', '_');   -- screens send 'own office' / 'not agent'
  if p_reason not in ('self','own_office','carrier','customer','not_agent') then
    raise exception 'invalid reason %', p_reason;
  end if;
  perform public.agent_code_detach(p_code);
  insert into public.os_agent_exclusions (code, reason, name, decided_by, decided_at, notes)
  values (p_code, p_reason, coalesce((select name from public.erp_account_ref where account_id = p_code),
                                    (select name from public.customers where account_id = p_code)),
          auth.uid(), now(), 'Set via review')
  on conflict (code) do update
    set reason = excluded.reason,
        name = coalesce(excluded.name, public.os_agent_exclusions.name),
        decided_by = excluded.decided_by, decided_at = now();
end $$;

create or replace function public.agent_review_reset(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  delete from public.os_agent_exclusions where code = p_code;
  perform public.agent_code_detach(p_code);
end $$;

-- Merge a duplicate agent into another: codes, networks, contacts, quotes, bookings, agreements,
-- meetings and rate requests move across, then the duplicate is removed.
create or replace function public.agent_merge(p_from uuid, p_into uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_from = p_into then raise exception 'same agent'; end if;
  if not exists (select 1 from public.agents where id = p_into) or not exists (select 1 from public.agents where id = p_from) then
    raise exception 'agent not found';
  end if;
  update public.agent_company_codes set agent_id = p_into where agent_id = p_from;
  insert into public.agent_networks (agent_id, network_id) select p_into, network_id from public.agent_networks where agent_id = p_from
    on conflict do nothing;
  update public.agent_contacts set agent_id = p_into where agent_id = p_from;
  update public.quotes set agent_id = p_into where agent_id = p_from;
  update public.bookings set os_agent_id = p_into where os_agent_id = p_from;
  update public.agency_agreements set agent_id = p_into where agent_id = p_from;
  update public.conference_meetings set agent_id = p_into where agent_id = p_from;
  update public.meeting_cards set agent_id = p_into where agent_id = p_from;
  update public.rate_request_recipients set agent_id = p_into where agent_id = p_from;
  update public.agents t set
    trusted = t.trusted or f.trusted,
    notes = nullif(concat_ws(E'\n', t.notes, 'Merged from ' || f.name || coalesce(' (' || f.erp_account_code || ')', '')), '')
  from public.agents f where t.id = p_into and f.id = p_from;
  delete from public.agents where id = p_from;
  return p_into;
end $$;

-- ── 5. Own-office accounts are never agents (UBNZ, UBLTK ... per company settings) ─────────
insert into public.os_agent_exclusions (code, reason, name, notes)
select distinct s.os_agent_code, 'own_office', coalesce(r.name, cu.name), 'Company own-office account (auto)'
from public.shipments s
join public.companies c on c.code = s.company_id
left join public.erp_account_ref r on r.account_id = s.os_agent_code
left join public.customers cu on cu.account_id = s.os_agent_code
where s.os_agent_code is not null
  and substr(s.os_agent_code, length(c.key_prefix) + 1) = any (c.erp_exclude_accounts)
  and not exists (select 1 from public.v_agent_codes ac where ac.code = s.os_agent_code)
on conflict (code) do nothing;

select public.apply_company_scope();

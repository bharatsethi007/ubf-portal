-- Control Tower v2 RPCs. Applied via Supabase MCP 2026-09-30. Repo parity copy, do not re-run.
-- Every RPC: staff gate + has_perm(module,'read'). No perm = null / empty.

create or replace function public.tower_can(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select ubf_is_staff() and has_perm(p_module, 'read');
$$;

create or replace function public.tower_today()
returns date language sql stable as $$ select (now() at time zone 'Pacific/Auckland')::date $$;

-- ── KPI pulse strip ──────────────────────────────────────────────
create or replace function public.tower_pulse(p_range text default 'week')
returns jsonb language plpgsql stable security definer set search_path = public, reporting as $$
declare b record; r jsonb := '{}'::jsonb; step interval; cur numeric; prv numeric; s jsonb;
  rc numeric; gc numeric; rp numeric; gp numeric;
begin
  if not ubf_is_staff() then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into b from ubf_bounds(p_range);
  step := case when p_range = 'week' then interval '7 days' else interval '1 month' end;

  if tower_can('shipments') then
    select count(*) filter (where relevant_date between b.ws and b.we),
           count(*) filter (where relevant_date between b.ps and b.pe)
      into cur, prv from shipments where relevant_date between b.ps and b.we;
    select jsonb_agg(n order by k desc) into s from (
      select k, (select count(*) from shipments where relevant_date > (b.we - step*(k+1))::date and relevant_date <= (b.we - step*k)::date) n
      from generate_series(7,0,-1) k) q;
    r := r || jsonb_build_object('jobs', jsonb_build_object('v', cur, 'delta', ubf_pct(cur, prv), 'series', s));

    select coalesce(sum(t.teu),0) into cur from mv_consol_teu t where t.consol_key in
      (select consol_key from shipments where mode='sea' and relevant_date between b.ws and b.we);
    select coalesce(sum(t.teu),0) into prv from mv_consol_teu t where t.consol_key in
      (select consol_key from shipments where mode='sea' and relevant_date between b.ps and b.pe);
    r := r || jsonb_build_object('teu', jsonb_build_object('v', cur, 'delta', ubf_pct(cur, prv)));
  end if;

  if tower_can('bookings') then
    select count(*) filter (where created_at::date between b.ws and b.we),
           count(*) filter (where created_at::date between b.ps and b.pe)
      into cur, prv from bookings;
    r := r || jsonb_build_object('bookings', jsonb_build_object('v', cur, 'delta', ubf_pct(cur, prv)));
  end if;

  if tower_can('reports') then
    select coalesce(sum(f.revenue) filter (where s.relevant_date between b.ws and b.we),0),
           coalesce(sum(f.gross_profit) filter (where s.relevant_date between b.ws and b.we),0),
           coalesce(sum(f.revenue) filter (where s.relevant_date between b.ps and b.pe),0),
           coalesce(sum(f.gross_profit) filter (where s.relevant_date between b.ps and b.pe),0)
      into rc, gc, rp, gp
      from shipments s left join reporting.mv_job_financials f on f.job_unique = s.job_unique
      where s.relevant_date between b.ps and b.we;
    select jsonb_agg(coalesce(v,0) order by k desc) into s from (
      select k, (select sum(f.revenue) from shipments s2 join reporting.mv_job_financials f on f.job_unique = s2.job_unique
                 where s2.relevant_date > (b.we - step*(k+1))::date and s2.relevant_date <= (b.we - step*k)::date) v
      from generate_series(7,0,-1) k) q;
    r := r || jsonb_build_object(
      'revenue', jsonb_build_object('v', round(rc), 'delta', ubf_pct(rc, rp), 'series', s),
      'gp_margin', (select jsonb_build_object(
          'v', round(sum(f.gross_profit) filter (where s.relevant_date between b.we-119 and b.we-30)
               / nullif(sum(f.revenue) filter (where s.relevant_date between b.we-119 and b.we-30),0)*100, 1),
          'delta_pt', round(sum(f.gross_profit) filter (where s.relevant_date between b.we-119 and b.we-30)
               / nullif(sum(f.revenue) filter (where s.relevant_date between b.we-119 and b.we-30),0)*100
             - sum(f.gross_profit) filter (where s.relevant_date between b.we-209 and b.we-120)
               / nullif(sum(f.revenue) filter (where s.relevant_date between b.we-209 and b.we-120),0)*100, 1))
        from shipments s join reporting.mv_job_financials f on f.job_unique = s.job_unique
        where s.relevant_date between b.we-209 and b.we-30));
  end if;

  if tower_can('ar') then
    select coalesce(sum(balance) filter (where date_due < tower_today()),0),
           coalesce(sum(balance),0)
      into cur, prv from invoices where balance > 0;
    r := r || jsonb_build_object('ar_overdue', jsonb_build_object('v', round(cur), 'outstanding', round(prv)));
  end if;
  return r;
end $$;

-- ── Needs you now ────────────────────────────────────────────────
create or replace function public.tower_actions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := '[]'::jsonb; t date := tower_today();
begin
  if not ubf_is_staff() then raise exception 'Not authorized' using errcode='42501'; end if;
  if tower_can('bookings') then
    r := r || (select jsonb_agg(x) from (
      select 'portal' key, 'Portal bookings to confirm' label, '/bookings' href, 'navy' tone,
             count(*) n, round(extract(epoch from now()-min(created_at))/3600) oldest_h
        from bookings where archived_at is null and source='customer_portal' and status='submitted'
      union all
      select 'email', 'Email drafts to approve', '/bookings', 'orange',
             count(*), round(extract(epoch from now()-min(created_at))/3600)
        from bookings where archived_at is null and source='email_import' and status='draft'
      union all
      select 'nojob', 'Bookings without job no.', '/bookings', 'sky',
             count(*), round(extract(epoch from now()-min(created_at))/3600)
        from bookings where archived_at is null and status='new' and job_no is null
    ) x);
  end if;
  if tower_can('quotes') then
    r := r || (select jsonb_agg(x) from (
      select 'topricing' key, 'Quotes to price' label, '/quotes' href, 'green' tone,
             count(*) n, round(extract(epoch from now()-min(q.created_at))/3600) oldest_h
        from quotes q where q.status='open'
         and not exists (select 1 from quote_responses qr where qr.quote_id=q.id)
      union all
      select 'expiring', 'Quotes expiring in 48h', '/quotes', 'amber', count(distinct q.id), null
        from quotes q join quote_responses qr on qr.quote_id=q.id
       where q.status='open' and qr.valid_till between t and t+2
    ) x);
  end if;
  if tower_can('rates') then
    r := r || (select jsonb_agg(x) from (
      select 'raterq' key, 'Rate requests over 24h' label, '/quotes' href, 'amber' tone,
             count(*) n, round(extract(epoch from now()-min(sent_at))/3600) oldest_h
        from rate_requests where status='sent' and sent_at < now()-interval '24 hours'
    ) x);
  end if;
  return r;
end $$;

-- ── Exceptions ───────────────────────────────────────────────────
create or replace function public.tower_exceptions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb := '[]'::jsonb; t date := tower_today();
begin
  if not ubf_is_staff() then raise exception 'Not authorized' using errcode='42501'; end if;
  if tower_can('bookings') then
    r := r || coalesce((select jsonb_agg(x) from (
      select case when d.section='empty_return' then 'lfd' else 'atport' end kind,
             coalesce(d.container_no,'No container') || ' · ' || coalesce(d.importer,'?') title,
             case when d.section='empty_return' then 'Empty return' else 'At port, not delivered' end
               || coalesce(' · ' || d.return_depot, '') sub,
             case when d.last_free_day < t then 'LFD +' || (t - d.last_free_day) || 'd'
                  when d.last_free_day = t then 'LFD today'
                  else 'LFD ' || (d.last_free_day - t) || 'd' end pill,
             case when d.last_free_day <= t then 'bad' else 'warn' end sev,
             d.last_free_day sort_key, d.job_no
        from import_sea_digest_rows(t) d
       where d.section in ('empty_return','at_port') and d.last_free_day between t - 30 and t + 2
      union all
      select 'hold', coalesce(b.job_no, b.booking_ref) || ' · ' || coalesce(b.importer_name, b.consignee_name, '?'),
             coalesce(b.hold_reason, 'On hold'), coalesce(b.hold_code,'Hold'), 'warn', t, b.job_no
        from bookings b where b.archived_at is null and (b.hold_code is not null or b.hold_reason is not null)
      union all
      select 'overdue', coalesce(b.job_no, b.booking_ref) || ' · ' || coalesce(b.vessel, b.vessel_flight, 'vessel ?'),
             'ETA passed, no discharge', 'ETA +' || (t - coalesce(b.m_eta,b.eta)) || 'd', 'warn',
             coalesce(b.m_eta,b.eta), b.job_no
        from bookings b where b.archived_at is null and b.mode='sea_import'
         and coalesce(b.m_eta,b.eta) between t - 30 and t - 2 and b.discharge_date is null
    ) x), '[]'::jsonb);
  end if;
  if tower_can('tms') then
    r := r || coalesce((select jsonb_agg(x) from (
      select 'tms' kind, c.consignment_no || ' · ' || coalesce(c.receiver_company,'?') title,
             'Delivery failed' || coalesce(' · ' || left(c.driver_notes, 40), '') sub,
             'Failed' pill, 'bad' sev, c.updated_at::date sort_key, null::text job_no
        from tms_consignments c where c.status='failed' and not coalesce(c.archived,false)
    ) x), '[]'::jsonb);
  end if;
  return coalesce((select jsonb_agg(e order by (e->>'sev')='bad' desc, e->>'sort_key') from jsonb_array_elements(r) e), '[]'::jsonb);
end $$;

-- ── Arrivals next 7 days ─────────────────────────────────────────
create or replace function public.tower_arrivals()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t date := tower_today();
begin
  if not tower_can('shipments') then return '[]'::jsonb; end if;
  return (select jsonb_agg(jsonb_build_object('d', g.d::date, 'dow', to_char(g.d,'Dy'),
      'fcl', coalesce(fcl,0), 'lcl', coalesce(lcl,0), 'air', coalesce(air,0)) order by g.d)
    from generate_series(t, t+6, interval '1 day') g(d)
    left join (select eta,
        count(*) filter (where mode='sea' and load_type='FCL') fcl,
        count(*) filter (where mode='sea' and coalesce(load_type,'') <> 'FCL') lcl,
        count(*) filter (where mode='air') air
      from shipments where direction='import' and eta between t and t+6 group by eta) s on s.eta = g.d::date);
end $$;

-- ── Cartage today ────────────────────────────────────────────────
create or replace function public.tower_tms()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t date := tower_today(); r jsonb;
begin
  if not tower_can('tms') then return null; end if;
  select jsonb_build_object(
    'delivered', count(*) filter (where (delivered_at at time zone 'Pacific/Auckland')::date = t),
    'on_road',   count(*) filter (where status='assigned' and not coalesce(archived,false)),
    'unassigned',count(*) filter (where status='unassigned' and not coalesce(archived,false)),
    'failed',    count(*) filter (where status='failed' and not coalesce(archived,false)))
  into r from tms_consignments;
  return r || jsonb_build_object(
    'trucks_total', (select count(*) from tms_vehicles),
    'trucks_live',  (select count(*) from tms_vehicle_positions_latest where recorded_at > now()-interval '40 minutes'));
end $$;

-- ── Quote pipeline ───────────────────────────────────────────────
create or replace function public.tower_quotes(p_range text default 'week')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ws date;
begin
  if not tower_can('quotes') then return null; end if;
  ws := case p_range when 'week' then tower_today()-6 when 'year' then tower_today()-364 else tower_today()-29 end;
  return (select jsonb_build_object(
      'requested', count(*),
      'priced', count(*) filter (where fr is not null),
      'sent', count(*) filter (where sent),
      'won', count(*) filter (where q.status='won'),
      'avg_reply_h', round(avg(extract(epoch from fr - q.created_at)/3600)::numeric,1))
    from quotes q
    left join lateral (select min(qr.created_at) fr, bool_or(qr.sent_to_portal_at is not null) sent
                         from quote_responses qr where qr.quote_id=q.id) x on true
    where q.created_at::date >= ws);
end $$;

-- ── CSAT ─────────────────────────────────────────────────────────
create or replace function public.tower_csat()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not tower_can('customers') then return null; end if;
  return (select jsonb_build_object(
      'avg', round(avg(score::numeric/nullif(score_max,0)*5) filter (where created_at > now()-interval '30 days'),2),
      'prev', round(avg(score::numeric/nullif(score_max,0)*5) filter (where created_at <= now()-interval '30 days'),2),
      'n', count(*) filter (where created_at > now()-interval '30 days'),
      'channels', coalesce((select jsonb_object_agg(channel, n) from (select channel, count(*) n from csat_responses
          where created_at > now()-interval '30 days' group by 1) c), '{}'::jsonb))
    from csat_responses where created_at > now()-interval '60 days');
end $$;

-- ── Receivables ──────────────────────────────────────────────────
create or replace function public.tower_ar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t date := tower_today();
begin
  if not tower_can('ar') then return null; end if;
  return jsonb_build_object(
    'ageing', (select jsonb_build_object(
        'current', round(coalesce(sum(balance) filter (where date_due is null or date_due >= t),0)),
        'd30', round(coalesce(sum(balance) filter (where t - date_due between 1 and 30),0)),
        'd60', round(coalesce(sum(balance) filter (where t - date_due between 31 and 60),0)),
        'd60p', round(coalesce(sum(balance) filter (where t - date_due > 60),0)))
      from invoices where balance > 0),
    'debtors', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select i.account_id, coalesce(c.name, max(i.company)) name,
             round(sum(i.balance)) total,
             round(coalesce(sum(i.balance) filter (where t - i.date_due > 60),0)) over60,
             round(coalesce(sum(i.balance) filter (where i.date_due < t),0)) overdue,
             min(i.date_due) filter (where i.date_due < t) oldest_due
        from invoices i left join customers c on c.account_id = i.account_id
       where i.balance > 0 group by i.account_id, c.name
      having sum(i.balance) filter (where i.date_due < t) > 0
       order by 5 desc limit 5) x));
end $$;

-- ── Top customers vs baseline ────────────────────────────────────
create or replace function public.tower_customers(p_range text default 'week')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b record; len int;
begin
  if not tower_can('customers') then return '[]'::jsonb; end if;
  select * into b from ubf_bounds(p_range);
  len := b.we - b.ws + 1;
  return (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
    select s.customer_account_id account_id, coalesce(c.name, s.customer_account_id) name,
           count(*) filter (where s.relevant_date between b.ws and b.we) n,
           round(count(*) filter (where s.relevant_date < b.ws)::numeric / 4, 1) base
      from shipments s left join customers c on c.account_id = s.customer_account_id
     where s.relevant_date between b.ws - len*4 and b.we and s.customer_account_id is not null
     group by 1,2 order by 3 desc limit 6) x where x.n > 0);
end $$;

-- ── Job volume, 9 buckets ────────────────────────────────────────
create or replace function public.tower_volume(p_range text default 'week')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b record; step interval;
begin
  if not tower_can('shipments') then return '[]'::jsonb; end if;
  select * into b from ubf_bounds(p_range);
  step := case when p_range='week' then interval '7 days' else interval '1 month' end;
  return (select jsonb_agg(jsonb_build_object('x', lbl, 'sea', sea, 'air', air, 'imp', imp, 'exp', exp) order by k desc) from (
    select k, case when p_range='week' then 'W' || to_char((b.we - step*k)::date, 'IW') else to_char((b.we - step*k)::date, 'Mon') end lbl,
      count(s.job_unique) filter (where s.mode='sea') sea, count(s.job_unique) filter (where s.mode='air') air,
      count(s.job_unique) filter (where s.direction='import') imp, count(s.job_unique) filter (where s.direction='export') exp
    from generate_series(0,8) k
    left join shipments s on s.relevant_date > (b.we - step*(k+1))::date and s.relevant_date <= (b.we - step*k)::date
    group by k) q);
end $$;

-- ── Network: lanes in transit now ────────────────────────────────
create or replace function public.tower_network()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t date := tower_today();
begin
  if not tower_can('shipments') then return null; end if;
  return jsonb_build_object(
    'lanes', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select s.origin o, s.destination d, s.mode, s.direction dir, count(*) n,
             po.lng olng, po.lat olat, pd.lng dlng, pd.lat dlat,
             round(avg(greatest(0, least(1, (t - s.etd)::numeric / nullif(s.eta - s.etd, 0)))), 2) prog
        from shipments s join ports po on po.code = s.origin join ports pd on pd.code = s.destination
       where s.etd <= t and s.eta >= t and s.arrived is null
         and po.lat is not null and pd.lat is not null and s.origin <> s.destination
       group by 1,2,3,4,6,7,8,9 order by 5 desc limit 60) x),
    'at_sea', (select count(*) from shipments where mode='sea' and etd <= t and eta >= t and arrived is null),
    'in_air', (select count(*) from shipments where mode='air' and etd <= t and eta >= t and arrived is null),
    'teu', (select coalesce(sum(teu),0) from mv_consol_teu where consol_key in
             (select consol_key from shipments where mode='sea' and etd <= t and eta >= t and arrived is null)));
end $$;

grant execute on function public.tower_pulse(text), public.tower_actions(), public.tower_exceptions(),
  public.tower_arrivals(), public.tower_tms(), public.tower_quotes(text), public.tower_csat(),
  public.tower_ar(), public.tower_customers(text), public.tower_volume(text), public.tower_network(),
  public.tower_can(text) to authenticated;
revoke execute on function public.tower_pulse(text), public.tower_actions(), public.tower_exceptions(),
  public.tower_arrivals(), public.tower_tms(), public.tower_quotes(text), public.tower_csat(),
  public.tower_ar(), public.tower_customers(text), public.tower_volume(text), public.tower_network() from anon;

-- ── Shipments in transit for the clustered map (house level, live AIS where fresh) ──
create or replace function public.tower_transit()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t date := tower_today();
begin
  if not tower_can('shipments') then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(x order by x.eta), '[]'::jsonb) from (
    select s.job_unique id, s.module, s.mode, s.direction dir, s.job_no, s.shipment_no ship_no, s.house_bill hbl, s.master_bill mbl,
           coalesce(c.name, s.customer_account_id) customer, s.customer_account_id acct,
           s.shipper_name shipper, s.consignee_name consignee, s.goods_desc goods,
           s.origin o, s.destination d, po.name oname, pd.name dname,
           round(po.lng::numeric,3) olng, round(po.lat::numeric,3) olat, round(pd.lng::numeric,3) dlng, round(pd.lat::numeric,3) dlat,
           s.etd, s.eta, s.departed, s.vessel_flight vessel, s.load_type, s.pack_qty, s.pack_type,
           round(s.weight_kg::numeric,0) kg, round(s.volume_m3::numeric,2) cbm, s.customer_ref ref,
           round(greatest(0.03, least(0.97, (t - coalesce(s.departed, s.etd))::numeric / nullif(s.eta - coalesce(s.departed, s.etd), 0))), 3) frac,
           case when vpl.id is not null then jsonb_build_object('lng', vpl.longitude, 'lat', vpl.latitude,
             'hdg', coalesce(nullif(vpl.true_heading, 511)::real, vpl.course_over_ground), 'kn', vpl.speed_over_ground,
             'ship', vpl.ship_name, 'at', vpl.position_timestamp) end live
      from shipments s
      join ports po on po.code = s.origin and po.lat is not null
      join ports pd on pd.code = s.destination and pd.lat is not null
      left join customers c on c.account_id = s.customer_account_id
      left join consol_tracking ct on ct.consol_key = s.consol_key and ct.vessel_key is not null and s.mode = 'sea'
      left join vessel_positions_latest vpl on vpl.vessel_key = ct.vessel_key and vpl.position_timestamp > now() - interval '72 hours'
     where coalesce(s.departed, s.etd) <= t and s.eta >= t and s.arrived is null and s.origin <> s.destination
     limit 1000) x);
end $$;
grant execute on function public.tower_transit() to authenticated;
revoke execute on function public.tower_transit() from anon;

notify pgrst, 'reload schema';

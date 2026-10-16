-- Customer rates phase 2: portal view, carrier "used by", notifications, daily watch, leaderboard.

-- Portal: the signed-in customer's live and upcoming rate cards. Sell side only.
create or replace function portal_my_rate_cards()
returns jsonb language sql stable security definer set search_path = public as $$
  with acct as (select my_account_id() as id),
  t as (select (now() at time zone 'Pacific/Auckland')::date as d),
  cards as (
    select c.*, cu.name as customer, su.full_name as sales_name, su.email as sales_email
    from customer_rate_cards c
    join acct on acct.id = c.account_id
    join customers cu on cu.account_id = c.account_id
    left join staff_users su on su.user_id = c.sales_id
    cross join t
    where c.status = 'live' and c.valid_to >= t.d
    order by c.valid_from
    limit 6
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'ref', c.ref, 'version', c.version, 'title', c.title, 'customer', c.customer, 'account_id', c.account_id,
    'valid_from', c.valid_from, 'valid_to', c.valid_to, 'presentation', c.presentation, 'fx', c.fx, 'published_at', c.published_at,
    'included', c.included, 'excluded', c.excluded, 'terms', c.terms, 'sales_name', c.sales_name, 'sales_email', c.sales_email,
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
        'product', l.product, 'origin_code', l.origin_code, 'dest_code', l.dest_code, 'container_type', l.container_type,
        'transit_days', l.transit_days, 'via', l.via, 'frequency', l.frequency, 'freight_sell', l.freight_sell, 'sell_min', l.sell_min,
        'sell_currency', l.sell_currency, 'origin_sell', l.origin_sell, 'origin_currency', l.origin_currency,
        'dest_sell', l.dest_sell, 'dest_currency', l.dest_currency) order by l.sort), '[]'::jsonb)
      from customer_rate_card_lines l where l.card_id = c.id and l.show and l.freight_sell is not null)
  ) order by c.valid_from), '[]'::jsonb)
  from cards c
$$;
grant execute on function portal_my_rate_cards() to authenticated;

-- Setup carrier card: customer rate cards priced from it.
create or replace function carrier_card_used_by(p_card uuid)
returns table (card_id uuid, ref text, version int, account_id text, customer text, status text, valid_from date, valid_to date,
               lanes int, gp_today numeric, pricing_id uuid)
language sql stable security definer set search_path = public as $$
  select c.id, c.ref, c.version, c.account_id, cu.name, c.status, c.valid_from, c.valid_to, count(l.id)::int,
         round(avg(case when l.freight_sell > 0 and cur.cb is not null then (l.freight_sell - cur.cb) / l.freight_sell * 100 end), 1),
         c.pricing_id
  from customer_rate_card_lines l
  join customer_rate_cards c on c.id = l.card_id
  join customers cu on cu.account_id = c.account_id
  left join lateral (
    select case l.source_table
      when 'fcl' then (select f.base_rate from rate_card_fcl_lines f where f.id = l.source_line_id)
      when 'lcl' then (select x.rate_per_wm from rate_card_lcl_lines x where x.id = l.source_line_id)
      when 'air' then (select a.rate_100 from rate_card_air_lines a where a.id = l.source_line_id) end as cb
  ) cur on true
  where l.source_card_id = p_card and l.show and c.status in ('draft', 'changes', 'pending', 'live') and is_staff()
  group by c.id, cu.name
  order by case c.status when 'live' then 0 when 'pending' then 1 else 2 end, c.valid_to desc
$$;
grant execute on function carrier_card_used_by(uuid) to authenticated;

-- Staff notification helper. One row per user, deduped.
create or replace function customer_rate_notify(p_user uuid, p_title text, p_body text, p_card uuid, p_dedupe text)
returns void language sql security definer set search_path = public as $$
  insert into staff_notifications (user_id, kind, title, body, link, actor_kind, actor_id, dedupe_key, facts)
  select p_user, 'rate_card', p_title, p_body, '/quotes/rate-cards/' || p_card, case when auth.uid() is null then 'system' else 'staff' end, auth.uid(), p_dedupe, jsonb_build_object('card_id', p_card)
  where p_user is not null and p_user is distinct from auth.uid()
  on conflict (dedupe_key) where dedupe_key is not null do nothing
$$;

create or replace function customer_rate_approvers()
returns setof uuid language sql stable security definer set search_path = public as $$
  select su.user_id from staff_users su where su.is_active and su.is_admin
  union
  select sur.user_id from staff_user_roles sur
  join roles r on r.id = sur.role_id and r.is_active
  join role_permissions rp on rp.role_id = r.id and rp.module_key = 'customer_rates_approve' and rp.can_edit
  join staff_users su on su.user_id = sur.user_id and su.is_active
$$;

-- Notify on workflow changes.
create or replace function customer_rate_card_event_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare c customer_rate_cards; who text; u uuid;
begin
  select * into c from customer_rate_cards where id = new.card_id;
  select coalesce(cu.name, c.account_id) into who from customers cu where cu.account_id = c.account_id;
  if new.kind = 'submitted' then
    for u in select * from customer_rate_approvers() loop
      perform customer_rate_notify(u, 'Rate card to approve', c.ref || ' · ' || who, c.id, 'rc-sub:' || new.id || ':' || u);
    end loop;
  elsif new.kind in ('changes_requested', 'published') then
    for u in select distinct x from unnest(array[c.sales_id, c.pricing_id, c.submitted_by, c.created_by]) x loop
      perform customer_rate_notify(u,
        case new.kind when 'published' then 'Rate card approved and live' else 'Changes asked on rate card' end,
        c.ref || ' · ' || who || coalesce(' · ' || nullif(new.detail->>'comment', ''), ''), c.id, 'rc-' || new.kind || ':' || new.id || ':' || u);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_customer_rate_card_event_notify on customer_rate_card_events;
create trigger trg_customer_rate_card_event_notify after insert on customer_rate_card_events
  for each row execute function customer_rate_card_event_notify();

-- Daily: expiring in 30 and 7 days (no renewal started), buy rate up since priced (weekly).
create or replace function customer_rate_cards_daily()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; d date := (now() at time zone 'Pacific/Auckland')::date; u uuid;
begin
  for r in
    select c.id, c.ref, c.valid_to, c.sales_id, c.pricing_id, coalesce(cu.name, c.account_id) as who, c.valid_to - d as left_days
    from customer_rate_cards c left join customers cu on cu.account_id = c.account_id
    where c.status = 'live' and c.valid_to - d in (30, 7)
      and not exists (select 1 from customer_rate_cards x where x.account_id = c.account_id and x.id <> c.id
                      and x.status in ('draft', 'changes', 'pending', 'live') and x.valid_from > c.valid_from)
  loop
    for u in select distinct x from unnest(array[r.sales_id, r.pricing_id]) x loop
      perform customer_rate_notify(u, 'Rate card expires in ' || r.left_days || ' days', r.ref || ' · ' || r.who || '. Renew it from the rate card.', r.id,
        'rc-exp' || r.left_days || ':' || r.id || ':' || u);
      n := n + 1;
    end loop;
  end loop;

  for r in
    select c.id, c.ref, c.pricing_id, c.sales_id, coalesce(cu.name, c.account_id) as who, l.buy_up
    from customer_rate_cards c
    left join customers cu on cu.account_id = c.account_id
    join lateral (
      select count(*) as buy_up from customer_rate_card_lines l
      left join lateral (select case l.source_table
          when 'fcl' then (select f.base_rate from rate_card_fcl_lines f where f.id = l.source_line_id)
          when 'lcl' then (select x.rate_per_wm from rate_card_lcl_lines x where x.id = l.source_line_id)
          when 'air' then (select a.rate_100 from rate_card_air_lines a where a.id = l.source_line_id) end as cb) cur on true
      where l.card_id = c.id and l.show and cur.cb > l.buy
    ) l on true
    where c.status = 'live' and c.valid_to >= d and l.buy_up > 0
  loop
    perform customer_rate_notify(coalesce(r.pricing_id, r.sales_id), 'Buy rate up on a live rate card',
      r.ref || ' · ' || r.who || ' · ' || r.buy_up || ' lane(s) now cost more than when priced.', r.id,
      'rc-buyup:' || r.id || ':' || to_char(d, 'IYYY-IW'));
    n := n + 1;
  end loop;
  return n;
end $$;

do $$ begin
  perform cron.unschedule('customer-rate-cards-daily') where exists (select 1 from cron.job where jobname = 'customer-rate-cards-daily');
  perform cron.schedule('customer-rate-cards-daily', '10 19 * * *', 'select public.customer_rate_cards_daily()');
end $$;

-- Leaderboard: rate cards per owner for the period.
create or replace function quotes_leaderboard_rate_cards(p_period text)
returns table (user_id uuid, name text, created int, published int, live_now int, lanes_live int, customers int, avg_gp numeric, hrs_to_approve numeric)
language sql stable security definer set search_path = public as $$
  with t as (select (now() at time zone 'Pacific/Auckland') as now_nz),
  since as (select (date_trunc(case p_period when 'week' then 'week' when 'month' then 'month' when 'quarter' then 'quarter' else 'year' end, t.now_nz)
                    at time zone 'Pacific/Auckland') as s, t.now_nz::date as d from t),
  c as (
    select c.*, coalesce(c.sales_id, c.created_by) as owner from customer_rate_cards c where c.status <> 'void'
  )
  select c.owner, coalesce(su.full_name, split_part(su.email, '@', 1), 'Unassigned'),
    count(*) filter (where c.created_at >= since.s)::int,
    count(*) filter (where c.published_at >= since.s)::int,
    count(*) filter (where c.status = 'live' and c.valid_from <= since.d and c.valid_to >= since.d)::int,
    coalesce(sum((select count(*) from customer_rate_card_lines l where l.card_id = c.id and l.show))
      filter (where c.status = 'live' and c.valid_from <= since.d and c.valid_to >= since.d), 0)::int,
    count(distinct c.account_id) filter (where c.status = 'live' and c.valid_to >= since.d)::int,
    round(avg((select avg(customer_rate_line_gp(l)) from customer_rate_card_lines l where l.card_id = c.id and l.show))
      filter (where c.published_at >= since.s), 1),
    round((percentile_cont(0.5) within group (order by extract(epoch from (c.approved_at - c.submitted_at)) / 3600)
      filter (where c.published_at >= since.s and c.submitted_at is not null))::numeric, 1)
  from c cross join since
  left join staff_users su on su.user_id = c.owner
  where is_staff()
  group by c.owner, su.full_name, su.email
  having count(*) filter (where c.created_at >= since.s or c.published_at >= since.s or (c.status = 'live' and c.valid_to >= since.d)) > 0
  order by 4 desc, 5 desc
$$;
grant execute on function quotes_leaderboard_rate_cards(text) to authenticated;

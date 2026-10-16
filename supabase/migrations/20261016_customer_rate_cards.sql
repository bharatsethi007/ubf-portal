-- Customer rates: rate cards built for one customer, approved by a pricing lead,
-- published as that customer's fixed contract rates (rate_margin_rules).

insert into app_modules (key, label, sort_order, is_active) values
  ('customer_rates', 'Customer rates', 22, true),
  ('customer_rates_approve', 'Customer rates approval', 23, true)
on conflict (key) do nothing;

-- Build: Admin, Sales, Sales Executive, Pricing Lead. Read: everyone with quotes read.
insert into role_permissions (role_id, module_key, can_read, can_add, can_edit, can_delete)
select r.id, 'customer_rates', true,
       r.name in ('Administrator', 'Sales', 'Sales Executive', 'Pricing Lead'),
       r.name in ('Administrator', 'Sales', 'Sales Executive', 'Pricing Lead'),
       r.name in ('Administrator', 'Pricing Lead')
from roles r
where exists (select 1 from role_permissions q where q.role_id = r.id and q.module_key = 'quotes' and q.can_read)
on conflict do nothing;

-- Approve and publish: Admin, Pricing Lead.
insert into role_permissions (role_id, module_key, can_read, can_add, can_edit, can_delete)
select r.id, 'customer_rates_approve', true, true, true, false
from roles r where r.name in ('Administrator', 'Pricing Lead')
on conflict do nothing;

create sequence if not exists customer_rate_card_seq;

create table if not exists customer_rate_cards (
  id uuid primary key default gen_random_uuid(),
  ref text,
  version int not null default 1,
  parent_id uuid references customer_rate_cards(id) on delete set null,
  account_id text not null references customers(account_id) on delete cascade,
  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'pending', 'changes', 'live', 'superseded', 'void')),
  valid_from date not null,
  valid_to date not null,
  presentation text not null default 'both' check (presentation in ('all_in', 'breakdown', 'both')),
  fx jsonb not null default '{}'::jsonb,           -- {"NZD": 0.56} = all-in currency per 1 unit
  sales_id uuid references staff_users(user_id),
  pricing_id uuid references staff_users(user_id),
  included text,
  excluded text,
  terms text,
  approver_note text,
  submitted_at timestamptz,
  submitted_by uuid references staff_users(user_id),
  approved_at timestamptz,
  approved_by uuid references staff_users(user_id),
  approval_comment text,
  low_gp_ack boolean not null default false,
  published_at timestamptz,
  created_by uuid default auth.uid() references staff_users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from),
  unique (ref, version)
);
create index if not exists customer_rate_cards_account on customer_rate_cards (account_id, status);

create table if not exists customer_rate_card_lines (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references customer_rate_cards(id) on delete cascade,
  sort int not null default 0,
  product text not null check (product in ('FCL', 'LCL', 'AIR')),
  origin_code text not null,
  dest_code text not null,
  container_type text,
  carrier text,
  transit_days int,
  via text,
  frequency text,
  source_table text check (source_table in ('fcl', 'lcl', 'air')),
  source_line_id uuid,
  source_card_id uuid references rate_cards(id) on delete set null,
  buy numeric,
  buy_currency text,
  margin_method text not null default 'rule' check (margin_method in ('rule', 'pct', 'flat', 'sell')),
  margin_value numeric,
  freight_sell numeric,
  sell_min numeric,
  sell_currency text not null default 'USD',
  origin_sell numeric,
  origin_currency text,
  dest_sell numeric,
  dest_currency text,
  show boolean not null default true,
  notes text,
  rule_id uuid references rate_margin_rules(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists customer_rate_card_lines_card on customer_rate_card_lines (card_id, sort);
create index if not exists customer_rate_card_lines_source on customer_rate_card_lines (source_card_id);

create table if not exists customer_rate_card_events (
  id bigserial primary key,
  card_id uuid not null references customer_rate_cards(id) on delete cascade,
  kind text not null,
  actor text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists customer_rate_card_events_card on customer_rate_card_events (card_id, created_at desc);

alter table rate_margin_rules add column if not exists customer_rate_card_id uuid references customer_rate_cards(id) on delete set null;

create or replace function customer_rate_card_stamp() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.ref is null then
    new.ref := 'RC-' || to_char(now() at time zone 'Pacific/Auckland', 'YYYY') || '-' || lpad(nextval('customer_rate_card_seq')::text, 3, '0');
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_customer_rate_card_stamp on customer_rate_cards;
create trigger trg_customer_rate_card_stamp before insert or update on customer_rate_cards
  for each row execute function customer_rate_card_stamp();

-- RLS: staff read. Editors change drafts only; status moves go through the RPCs below.
alter table customer_rate_cards enable row level security;
alter table customer_rate_card_lines enable row level security;
alter table customer_rate_card_events enable row level security;

drop policy if exists crc_read on customer_rate_cards;
create policy crc_read on customer_rate_cards for select using (is_staff());
drop policy if exists crc_insert on customer_rate_cards;
create policy crc_insert on customer_rate_cards for insert with check (has_perm('customer_rates', 'add') and status = 'draft');
drop policy if exists crc_update on customer_rate_cards;
create policy crc_update on customer_rate_cards for update
  using (has_perm('customer_rates', 'edit') and status in ('draft', 'changes'))
  with check (has_perm('customer_rates', 'edit') and status in ('draft', 'changes', 'void'));

drop policy if exists crcl_read on customer_rate_card_lines;
create policy crcl_read on customer_rate_card_lines for select using (is_staff());
drop policy if exists crcl_write on customer_rate_card_lines;
create policy crcl_write on customer_rate_card_lines for all
  using (has_perm('customer_rates', 'edit') and exists (select 1 from customer_rate_cards c where c.id = card_id and c.status in ('draft', 'changes')))
  with check (has_perm('customer_rates', 'edit') and exists (select 1 from customer_rate_cards c where c.id = card_id and c.status in ('draft', 'changes')));

drop policy if exists crce_read on customer_rate_card_events;
create policy crce_read on customer_rate_card_events for select using (is_staff());
drop policy if exists crce_insert on customer_rate_card_events;
create policy crce_insert on customer_rate_card_events for insert with check (is_staff());

-- GP floor for the approval warning (freight GP, %).
create or replace function customer_rate_gp_floor() returns numeric language sql immutable as $$ select 10::numeric $$;

-- Freight GP % for a line, null when buy or sell missing.
create or replace function customer_rate_line_gp(l customer_rate_card_lines) returns numeric language sql immutable as $$
  select case when l.freight_sell is null or l.freight_sell = 0 or l.buy is null then null
              else round((l.freight_sell - l.buy) / l.freight_sell * 100, 1) end
$$;

-- Current buy and validity of each line's source carrier rate, for watch alerts.
create or replace function customer_rate_card_watch(p_card uuid)
returns table (line_id uuid, current_buy numeric, source_valid_to date, source_title text, source_status text)
language sql stable security definer set search_path = public as $$
  select l.id,
         case l.source_table
           when 'fcl' then (select f.base_rate from rate_card_fcl_lines f where f.id = l.source_line_id)
           when 'lcl' then (select x.rate_per_wm from rate_card_lcl_lines x where x.id = l.source_line_id)
           when 'air' then (select a.rate_100 from rate_card_air_lines a where a.id = l.source_line_id)
         end,
         rc.valid_to, rc.title, rc.status
  from customer_rate_card_lines l
  left join rate_cards rc on rc.id = l.source_card_id
  where l.card_id = p_card and is_staff()
$$;

-- List for Quotes > Customer rates.
create or replace function customer_rate_cards_list()
returns table (
  id uuid, ref text, version int, account_id text, customer text, title text, status text,
  valid_from date, valid_to date, sales_id uuid, pricing_id uuid, submitted_at timestamptz, published_at timestamptz,
  updated_at timestamptz, lanes int, shown int, modes text[], gp numeric, min_gp numeric, buy_up int, source_expiring int
)
language sql stable security definer set search_path = public as $$
  with w as (
    select l.card_id,
           count(*) filter (where cur.cb is not null and l.buy is not null and cur.cb > l.buy) as buy_up,
           count(*) filter (where rc.valid_to is not null and rc.valid_to < c.valid_to) as src_exp
    from customer_rate_card_lines l
    join customer_rate_cards c on c.id = l.card_id
    left join rate_cards rc on rc.id = l.source_card_id
    left join lateral (
      select case l.source_table
        when 'fcl' then (select f.base_rate from rate_card_fcl_lines f where f.id = l.source_line_id)
        when 'lcl' then (select x.rate_per_wm from rate_card_lcl_lines x where x.id = l.source_line_id)
        when 'air' then (select a.rate_100 from rate_card_air_lines a where a.id = l.source_line_id) end as cb
    ) cur on true
    where l.show and c.status in ('live', 'pending', 'draft', 'changes')
    group by l.card_id
  )
  select c.id, c.ref, c.version, c.account_id, cu.name, c.title, c.status, c.valid_from, c.valid_to,
         c.sales_id, c.pricing_id, c.submitted_at, c.published_at, c.updated_at,
         (select count(*)::int from customer_rate_card_lines l where l.card_id = c.id),
         (select count(*)::int from customer_rate_card_lines l where l.card_id = c.id and l.show),
         (select coalesce(array_agg(distinct l.product order by l.product), '{}') from customer_rate_card_lines l where l.card_id = c.id and l.show),
         (select round(avg(customer_rate_line_gp(l)), 1) from customer_rate_card_lines l where l.card_id = c.id and l.show),
         (select min(customer_rate_line_gp(l)) from customer_rate_card_lines l where l.card_id = c.id and l.show),
         coalesce(w.buy_up, 0)::int, coalesce(w.src_exp, 0)::int
  from customer_rate_cards c
  join customers cu on cu.account_id = c.account_id
  left join w on w.card_id = c.id
  where is_staff() and c.status <> 'void'
  order by c.updated_at desc
  limit 1000
$$;

-- Carrier rate lines a card can be priced from.
create or replace function customer_rate_candidates(p_product text, p_origin text, p_dest text, p_container text)
returns table (
  source_table text, line_id uuid, card_id uuid, card_title text, vendor text, card_valid_to date,
  origin_code text, dest_code text, container_type text, buy numeric, buy_min numeric, currency text,
  transit_days int, via text, frequency text
)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'fcl', f.id, rc.id, rc.title, coalesce(rc.vendor_name, rc.shipping_line_code), rc.valid_to,
           coalesce(f.origin_port_code, f.origin_group_code), f.dest_port_code, f.container_type, f.base_rate, null::numeric,
           coalesce(f.currency_code, rc.currency_code), f.transit_days, f.via, null::text
    from rate_card_fcl_lines f join rate_cards rc on rc.id = f.rate_card_id
    where upper(p_product) = 'FCL'
    union all
    select 'lcl', x.id, rc.id, rc.title, coalesce(rc.vendor_name, rc.co_loader_code), rc.valid_to,
           coalesce(x.origin_port_code, x.origin_group_code), x.dest_port_code, null, x.rate_per_wm, x.min_charge,
           coalesce(x.currency_code, rc.currency_code), x.transit_days, x.via, x.frequency
    from rate_card_lcl_lines x join rate_cards rc on rc.id = x.rate_card_id
    where upper(p_product) = 'LCL'
    union all
    select 'air', a.id, rc.id, rc.title, coalesce(rc.vendor_name, rc.shipping_line_code), rc.valid_to,
           coalesce(a.origin_port_code, a.origin_group_code), a.dest_port_code, null, a.rate_100, a.min_charge,
           coalesce(a.currency_code, rc.currency_code), a.transit_days, a.via, a.frequency
    from rate_card_air_lines a join rate_cards rc on rc.id = a.rate_card_id
    where upper(p_product) = 'AIR'
  ) t (source_table, line_id, card_id, card_title, vendor, card_valid_to, origin_code, dest_code, container_type, buy, buy_min, currency, transit_days, via, frequency)
  where is_staff()
    and t.buy is not null and t.buy > 0
    and exists (select 1 from rate_cards rc where rc.id = t.card_id and rc.status in ('active', 'validated')
                and (rc.valid_to is null or rc.valid_to >= (now() at time zone 'Pacific/Auckland')::date))
    and (coalesce(p_dest, '') = '' or t.dest_code = upper(p_dest))
    and (coalesce(p_origin, '') = '' or t.origin_code = upper(p_origin))
    and (coalesce(p_container, '') = '' or t.container_type = upper(p_container))
  order by t.origin_code, t.dest_code, t.container_type nulls first, t.buy
  limit 400
$$;

-- Sales or pricing: send for approval.
create or replace function customer_rate_card_submit(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare c customer_rate_cards; v_email text;
begin
  if not has_perm('customer_rates', 'edit') then raise exception 'Not allowed'; end if;
  select * into c from customer_rate_cards where id = p_id for update;
  if c.id is null then raise exception 'Rate card not found'; end if;
  if c.status not in ('draft', 'changes') then raise exception 'Only drafts can be sent for approval'; end if;
  if not exists (select 1 from customer_rate_card_lines where card_id = p_id and show and freight_sell is not null) then
    raise exception 'Add at least one priced lane';
  end if;
  update customer_rate_cards set status = 'pending', submitted_at = now(), submitted_by = auth.uid(),
    approver_note = nullif(trim(coalesce(p_note, '')), '') where id = p_id;
  select email into v_email from staff_users where user_id = auth.uid();
  insert into customer_rate_card_events (card_id, kind, actor, detail) values (p_id, 'submitted', v_email, jsonb_build_object('note', p_note));
end $$;

-- Pricing lead: send back with a comment.
create or replace function customer_rate_card_request_changes(p_id uuid, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not has_perm('customer_rates_approve', 'edit') then raise exception 'Only pricing leads can review rate cards'; end if;
  update customer_rate_cards set status = 'changes', approval_comment = nullif(trim(coalesce(p_comment, '')), '')
   where id = p_id and status = 'pending';
  if not found then raise exception 'Rate card is not waiting for approval'; end if;
  select email into v_email from staff_users where user_id = auth.uid();
  insert into customer_rate_card_events (card_id, kind, actor, detail) values (p_id, 'changes_requested', v_email, jsonb_build_object('comment', p_comment));
end $$;

-- Pricing lead: approve and publish. Lines become fixed contract rates for the customer.
create or replace function customer_rate_card_publish(p_id uuid, p_comment text, p_ack_low_gp boolean)
returns int language plpgsql security definer set search_path = public as $$
declare
  c customer_rate_cards; l customer_rate_card_lines; v_rule uuid; v_email text; n int := 0; v_low int;
begin
  if not has_perm('customer_rates_approve', 'edit') then raise exception 'Only pricing leads can approve rate cards'; end if;
  select * into c from customer_rate_cards where id = p_id for update;
  if c.id is null then raise exception 'Rate card not found'; end if;
  if c.status <> 'pending' then raise exception 'Rate card is not waiting for approval'; end if;

  select count(*) into v_low from customer_rate_card_lines x
   where x.card_id = p_id and x.show and customer_rate_line_gp(x) < customer_rate_gp_floor();
  if v_low > 0 and not coalesce(p_ack_low_gp, false) then
    raise exception '% lane(s) under the % %% GP floor. Confirm them to publish.', v_low, customer_rate_gp_floor();
  end if;

  -- A revision replaces its parent from the new start date.
  if c.parent_id is not null then
    delete from rate_margin_rules where customer_rate_card_id = c.parent_id and valid_from >= c.valid_from;
    update rate_margin_rules set valid_to = c.valid_from - 1
     where customer_rate_card_id = c.parent_id and (valid_to is null or valid_to >= c.valid_from);
    update customer_rate_cards set status = 'superseded' where id = c.parent_id and status = 'live';
  end if;

  for l in select * from customer_rate_card_lines where card_id = p_id and show and freight_sell is not null order by sort loop
    -- Other live rates for this exact lane end the day before this card starts.
    update rate_margin_rules r set valid_to = c.valid_from - 1
     where r.account_id = c.account_id and r.product = l.product and r.method = 'fixed'
       and coalesce(r.origin_code, '') = upper(l.origin_code) and coalesce(r.dest_code, '') = upper(l.dest_code)
       and coalesce(r.container_type, '') = case when l.product = 'FCL' then coalesce(upper(l.container_type), '') else '' end
       and coalesce(r.carrier, '') = ''
       and coalesce(r.valid_from, '1900-01-01') < c.valid_from
       and (r.valid_to is null or r.valid_to >= c.valid_from);

    insert into rate_margin_rules (account_id, product, method, value, min_margin, origin_code, dest_code, container_type, carrier,
                                   currency_code, valid_from, valid_to, active, notes, updated_by, customer_rate_card_id)
    values (c.account_id, l.product, 'fixed', round(l.freight_sell, 2), null, upper(l.origin_code), upper(l.dest_code),
            case when l.product = 'FCL' then upper(l.container_type) end, null, upper(l.sell_currency),
            c.valid_from, c.valid_to, true, c.ref, auth.uid(), c.id)
    on conflict (coalesce(account_id, ''::text), product, coalesce(origin_code, ''::text), coalesce(dest_code, ''::text),
                 coalesce(container_type, ''::text), coalesce(carrier, ''::text), coalesce(valid_from, '1900-01-01'::date))
    do update set method = 'fixed', value = excluded.value, min_margin = null, currency_code = excluded.currency_code,
                  valid_to = excluded.valid_to, active = true, notes = excluded.notes, updated_by = excluded.updated_by,
                  customer_rate_card_id = excluded.customer_rate_card_id
    returning id into v_rule;
    update customer_rate_card_lines set rule_id = v_rule where id = l.id;
    n := n + 1;
  end loop;

  update customer_rate_cards set status = 'live', approved_at = now(), approved_by = auth.uid(), published_at = now(),
    approval_comment = nullif(trim(coalesce(p_comment, '')), ''), low_gp_ack = coalesce(p_ack_low_gp, false)
   where id = p_id;
  select email into v_email from staff_users where user_id = auth.uid();
  insert into customer_rate_card_events (card_id, kind, actor, detail)
  values (p_id, 'published', v_email, jsonb_build_object('rules', n, 'comment', p_comment, 'low_gp_ack', p_ack_low_gp));
  return n;
end $$;

-- Withdraw a live card: its contract rates stop today.
create or replace function customer_rate_card_withdraw(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; v_today date := (now() at time zone 'Pacific/Auckland')::date;
begin
  if not has_perm('customer_rates_approve', 'edit') then raise exception 'Only pricing leads can withdraw rate cards'; end if;
  delete from rate_margin_rules where customer_rate_card_id = p_id and valid_from > v_today;
  update rate_margin_rules set valid_to = v_today - 1 where customer_rate_card_id = p_id and (valid_to is null or valid_to >= v_today);
  update customer_rate_cards set status = 'void' where id = p_id and status = 'live';
  if not found then raise exception 'Rate card is not live'; end if;
  select email into v_email from staff_users where user_id = auth.uid();
  insert into customer_rate_card_events (card_id, kind, actor) values (p_id, 'withdrawn', v_email);
end $$;

-- Copy a card into a new draft version (revise or renew).
create or replace function customer_rate_card_revise(p_id uuid, p_renew boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare c customer_rate_cards; v_new uuid; v_len int; v_email text;
begin
  if not has_perm('customer_rates', 'add') then raise exception 'Not allowed'; end if;
  select * into c from customer_rate_cards where id = p_id;
  if c.id is null then raise exception 'Rate card not found'; end if;
  v_len := c.valid_to - c.valid_from;
  insert into customer_rate_cards (ref, version, parent_id, account_id, title, status, valid_from, valid_to, presentation, fx,
                                   sales_id, pricing_id, included, excluded, terms, created_by)
  values (case when p_renew then null else c.ref end, case when p_renew then 1 else c.version + 1 end,
          case when p_renew then null else c.id end, c.account_id, c.title, 'draft',
          case when p_renew then c.valid_to + 1 else greatest(c.valid_from, (now() at time zone 'Pacific/Auckland')::date) end,
          case when p_renew then c.valid_to + 1 + v_len else c.valid_to end,
          c.presentation, c.fx, c.sales_id, c.pricing_id, c.included, c.excluded, c.terms, auth.uid())
  returning id into v_new;
  insert into customer_rate_card_lines (card_id, sort, product, origin_code, dest_code, container_type, carrier, transit_days, via, frequency,
    source_table, source_line_id, source_card_id, buy, buy_currency, margin_method, margin_value, freight_sell, sell_min, sell_currency,
    origin_sell, origin_currency, dest_sell, dest_currency, show, notes)
  select v_new, sort, product, origin_code, dest_code, container_type, carrier, transit_days, via, frequency,
    source_table, source_line_id, source_card_id, buy, buy_currency, margin_method, margin_value, freight_sell, sell_min, sell_currency,
    origin_sell, origin_currency, dest_sell, dest_currency, show, notes
  from customer_rate_card_lines where card_id = p_id;
  select email into v_email from staff_users where user_id = auth.uid();
  insert into customer_rate_card_events (card_id, kind, actor, detail)
  values (v_new, case when p_renew then 'renewed_from' else 'revised_from' end, v_email, jsonb_build_object('from', c.ref, 'version', c.version));
  return v_new;
end $$;

grant execute on function customer_rate_cards_list() to authenticated;
grant execute on function customer_rate_card_watch(uuid) to authenticated;
grant execute on function customer_rate_candidates(text, text, text, text) to authenticated;
grant execute on function customer_rate_card_submit(uuid, text) to authenticated;
grant execute on function customer_rate_card_request_changes(uuid, text) to authenticated;
grant execute on function customer_rate_card_publish(uuid, text, boolean) to authenticated;
grant execute on function customer_rate_card_withdraw(uuid) to authenticated;
grant execute on function customer_rate_card_revise(uuid, boolean) to authenticated;

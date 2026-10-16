-- Agent job classification from billing (Bharat, 16 Oct 2026):
--   Free hand import  = no freight billed by us (NZ clearance / delivery only).
--   Free hand export  = freight billed to the agent.
--   Nomination        = freight billed to the customer (we control, agent used), import or export.
--   Unbilled          = nothing invoiced yet. Left out of stats.
--   Exception         = export billed with no freight line, import freight billed to agent, or freight to both.
-- Staff can override any job (agent_job_overrides). Final class = override, else auto.

create table if not exists agent_job_overrides (
  job_unique bigint primary key,
  class text not null check (class in ('freehand', 'nomination', 'excluded')),
  note text,
  set_by uuid default auth.uid() references staff_users(user_id),
  set_at timestamptz not null default now()
);
alter table agent_job_overrides enable row level security;
drop policy if exists ajo_read on agent_job_overrides;
create policy ajo_read on agent_job_overrides for select using (is_staff());

create or replace function agent_freight_codes() returns text[] language sql stable as $$
  select array(select erp_code from erp_charge_map where treat_as = 'freight'
               union select unnest(array['FAKFIS', 'USDEX', 'USDIM', 'USEAS', 'USIAS']))
$$;

create or replace view v_agent_jobs as
with legs as (
  select a.id as agent_id, a.erp_account_code as agent_code, l.job_unique,
         min(l.job_no) as job_no, min(l.house_bill) as house_bill, min(l.direction) as direction, min(l.mode) as mode,
         min(l.load_type) as load_type, min(l.origin) as origin, min(l.destination) as destination,
         min(l.customer_account_id) as customer_account_id, min(coalesce(l.etd, l.doc_date)) as dt, max(l.weight_kg) as weight_kg
  from agents a join shipment_legs l on l.os_agent_code = a.erp_account_code
  where coalesce(l.etd, l.doc_date) >= current_date - 760 and l.direction in ('import', 'export')
  group by a.id, a.erp_account_code, l.job_unique
),
ch as (
  select g.job_unique,
         count(*) filter (where c.sell <> 0) as lines,
         bool_or(c.sell <> 0 and c.charge_code = any (agent_freight_codes()) and c.bill_to = g.agent_code) as frt_agent,
         bool_or(c.sell <> 0 and c.charge_code = any (agent_freight_codes()) and c.bill_to is distinct from g.agent_code) as frt_other,
         sum(c.sell) filter (where c.charge_code = any (agent_freight_codes())) as frt_sell,
         string_agg(distinct c.bill_to, ', ') filter (where c.sell <> 0 and c.charge_code = any (agent_freight_codes())) as frt_bill_to
  from legs g join job_charges c on c.job_unique = g.job_unique
  group by g.job_unique
)
select g.*,
  coalesce(ch.lines, 0) as charge_lines, coalesce(ch.frt_agent, false) as frt_agent, coalesce(ch.frt_other, false) as frt_other,
  ch.frt_sell, ch.frt_bill_to,
  case
    when coalesce(ch.lines, 0) = 0 then 'unbilled'
    when ch.frt_agent and ch.frt_other then 'exception'
    when ch.frt_other then 'nomination'
    when ch.frt_agent then case when g.direction = 'export' then 'freehand' else 'exception' end
    else case when g.direction = 'import' then 'freehand' else 'exception' end
  end as auto_class,
  o.class as override_class
from legs g left join ch on ch.job_unique = g.job_unique
left join agent_job_overrides o on o.job_unique = g.job_unique;

-- Final class used by every stat.
create or replace function agent_job_final(auto_class text, override_class text) returns text language sql immutable as $$
  select coalesce(override_class, auto_class)
$$;

-- Directory and profile tiles read this view. Same columns as before, new rule.
create or replace view v_agent_bookings_12m as
select j.agent_id,
  (count(*) filter (where agent_job_final(j.auto_class, j.override_class) = 'freehand'))::integer as freehand,
  (count(*) filter (where agent_job_final(j.auto_class, j.override_class) = 'nomination'))::integer as booked,
  round(sum(coalesce(j.weight_kg, 0)) filter (where agent_job_final(j.auto_class, j.override_class) = 'freehand')) as freehand_kg,
  round(sum(coalesce(j.weight_kg, 0)) filter (where agent_job_final(j.auto_class, j.override_class) = 'nomination')) as booked_kg,
  round(sum(f.gross_profit) filter (where agent_job_final(j.auto_class, j.override_class) = 'freehand')) as freehand_gp,
  round(sum(f.gross_profit) filter (where agent_job_final(j.auto_class, j.override_class) = 'nomination')) as booked_gp
from v_agent_jobs j
left join reporting.mv_job_financials f on f.job_unique = j.job_unique
where j.dt >= current_date - 365
group by j.agent_id;

-- Jobs list for the review popup.
create or replace function agent_jobs_list(p_from date, p_to date)
returns table (
  job_unique bigint, job_no text, house_bill text, direction text, mode text, load_type text, origin text, destination text, dt date,
  agent_id uuid, agent text, networks text[], customer_account_id text, customer text,
  auto_class text, class text, overridden boolean, override_note text, frt_bill_to text, frt_sell numeric, gp numeric, charge_lines int
)
language sql stable security definer set search_path = public, reporting as $$
  select j.job_unique, j.job_no::text, j.house_bill::text, j.direction, j.mode::text, j.load_type::text, j.origin::text, j.destination::text, j.dt,
         j.agent_id, a.name,
         coalesce((select array_agg(fn.code order by fn.code) from agent_networks an join freight_networks fn on fn.id = an.network_id where an.agent_id = j.agent_id), '{}'),
         j.customer_account_id::text, cu.name,
         j.auto_class, agent_job_final(j.auto_class, j.override_class), j.override_class is not null, o.note,
         j.frt_bill_to, round(j.frt_sell, 2), round(f.gross_profit, 2), j.charge_lines::int
  from v_agent_jobs j
  join agents a on a.id = j.agent_id
  left join customers cu on cu.account_id = j.customer_account_id
  left join agent_job_overrides o on o.job_unique = j.job_unique
  left join reporting.mv_job_financials f on f.job_unique = j.job_unique
  where is_staff() and j.dt >= p_from and j.dt <= p_to
  order by j.dt desc
  limit 6000
$$;
grant execute on function agent_jobs_list(date, date) to authenticated;

-- Mark jobs. p_class: freehand | nomination | excluded | auto (back to the billing rule).
create or replace function agent_jobs_set_class(p_jobs bigint[], p_class text, p_note text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not has_perm('agents', 'edit') then raise exception 'Not allowed to change agent jobs'; end if;
  if p_class = 'auto' then
    delete from agent_job_overrides where job_unique = any (p_jobs);
    get diagnostics n = row_count; return n;
  end if;
  if p_class not in ('freehand', 'nomination', 'excluded') then raise exception 'Unknown class %', p_class; end if;
  insert into agent_job_overrides (job_unique, class, note, set_by, set_at)
  select unnest(p_jobs), p_class, nullif(trim(coalesce(p_note, '')), ''), auth.uid(), now()
  on conflict (job_unique) do update set class = excluded.class, note = coalesce(excluded.note, agent_job_overrides.note),
    set_by = excluded.set_by, set_at = excluded.set_at;
  get diagnostics n = row_count; return n;
end $$;
grant execute on function agent_jobs_set_class(bigint[], text, text) to authenticated;

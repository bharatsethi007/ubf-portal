-- 20260929_booking_shipment_auto_match.sql
-- Ties bookings (portal / staff; tracked by PortConnect + SeaVantage) to ERP shipments (CyberFreight / TradeWindow).
-- Signals: container overlap, MBL (incl. SCAC-prefixed variants), typed consol ref, house bill, ETA proximity.
-- Hard filters: same customer account, matching ERP module, +/- 90 days.
-- Auto-links only a clear winner (score >= 60, runner-up at least 20 behind). Everything is logged.
-- Never re-links a booking that was auto-linked before (staff unlink sticks).

create or replace function public.norm_ref(p text)
returns text language sql immutable parallel safe
as $$ select nullif(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), '') $$;

create table if not exists public.booking_shipment_match_log (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  job_unique bigint,
  score int,
  reasons text[],
  action text not null check (action in ('auto_linked', 'ambiguous', 'unlinked_mismatch')),
  created_at timestamptz not null default now()
);
create index if not exists booking_shipment_match_log_booking_idx on public.booking_shipment_match_log (booking_id, created_at desc);
alter table public.booking_shipment_match_log enable row level security;
drop policy if exists staff_read_match_log on public.booking_shipment_match_log;
create policy staff_read_match_log on public.booking_shipment_match_log for select using (public.is_staff());

create or replace function public.booking_shipment_candidates(p_booking uuid)
returns table (job_unique bigint, consol_key text, score int, reasons text[])
language sql stable security definer set search_path = public
as $$
with guard as (select (public.is_staff() or auth.uid() is null) as ok),
b as (
  select bk.*,
         case bk.module when 'IS' then 'FIS' when 'IA' then 'FIA' when 'ES' then 'FES' when 'EA' then 'FEA' end as erp_module,
         coalesce(bk.m_eta, bk.eta, bk.created_at::date) as ref_date,
         array_remove(array[bk.account_id, bk.consignee_account_id, bk.importer_account_id], null) as accounts
    from bookings bk, guard where bk.id = p_booking and guard.ok
),
boxes as (
  select distinct norm_ref(bc.container_no) as box from booking_containers bc where bc.booking_id = p_booking and norm_ref(bc.container_no) is not null
),
cand as (
  select s.* from shipments s, b
   where s.module = b.erp_module
     and s.customer_account_id = any (b.accounts)
     and coalesce(s.eta, s.etd, s.doc_date) between b.ref_date - 90 and b.ref_date + 90
),
scored as (
  select c.job_unique, c.consol_key,
         (select count(*) from containers ct join boxes x on x.box = norm_ref(ct.c_number) where ct.consol_key = c.consol_key)::int as box_hits,
         (norm_ref(b.mbl_no) is not null and norm_ref(c.master_bill) is not null and length(norm_ref(c.master_bill)) >= 8
           and (norm_ref(b.mbl_no) = norm_ref(c.master_bill) or norm_ref(b.mbl_no) like '%' || norm_ref(c.master_bill)
                or norm_ref(c.master_bill) like '%' || norm_ref(b.mbl_no))) as mbl_hit,
         (norm_ref(b.job_no) is not null and (norm_ref(b.job_no) = norm_ref(c.consol_key) or norm_ref(b.erp_internal_job_no) = norm_ref(c.consol_key))) as ref_hit,
         (norm_ref(b.hawb) is not null and norm_ref(b.hawb) = norm_ref(c.house_bill)) as hbl_hit,
         (c.eta is not null and b.ref_date is not null and abs(c.eta - b.ref_date) <= 3) as eta_hit
    from cand c, b
)
select job_unique, consol_key,
       (case when box_hits > 0 then least(80, 60 + 10 * (box_hits - 1)) else 0 end
        + case when mbl_hit then 50 else 0 end
        + case when ref_hit then 40 else 0 end
        + case when hbl_hit then 60 else 0 end
        + case when eta_hit then 10 else 0 end)::int as score,
       array_remove(array[
         case when box_hits > 0 then box_hits || ' container match' end,
         case when mbl_hit then 'MBL match' end,
         case when ref_hit then 'consol ref match' end,
         case when hbl_hit then 'house bill match' end,
         case when eta_hit then 'ETA within 3 days' end], null) as reasons
  from scored
 where box_hits > 0 or mbl_hit or ref_hit or hbl_hit
 order by 3 desc, job_unique desc
$$;

create or replace function public.auto_link_bookings()
returns int language plpgsql security definer set search_path = public
as $$
declare
  r record;
  top record;
  second_score int;
  n int := 0;
begin
  for r in
    select bk.id from bookings bk
     where bk.archived_at is null
       and bk.shipment_id is null
       and bk.created_at > now() - interval '240 days'
       and not exists (select 1 from booking_shipment_match_log l where l.booking_id = bk.id and l.action = 'auto_linked')
  loop
    select * into top from booking_shipment_candidates(r.id) limit 1;
    if top.job_unique is null or top.score < 60 then continue; end if;
    select c.score into second_score from booking_shipment_candidates(r.id) c offset 1 limit 1;
    if second_score is not null and second_score > top.score - 20 then
      if not exists (select 1 from booking_shipment_match_log l where l.booking_id = r.id and l.action = 'ambiguous' and l.created_at > now() - interval '1 day') then
        insert into booking_shipment_match_log (booking_id, job_unique, score, reasons, action) values (r.id, top.job_unique, top.score, top.reasons, 'ambiguous');
      end if;
      continue;
    end if;
    update bookings set shipment_id = top.job_unique where id = r.id and shipment_id is null;
    insert into booking_shipment_match_log (booking_id, job_unique, score, reasons, action) values (r.id, top.job_unique, top.score, top.reasons, 'auto_linked');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.booking_shipment_candidates(uuid) from public, anon;
revoke all on function public.auto_link_bookings() from public, anon, authenticated;
grant execute on function public.booking_shipment_candidates(uuid) to authenticated;

-- Applied once on 29 Sep: removed two wrong links from the 5 Aug backfill (UBF-SI-26-0018, UBF-2026-0006),
-- both logged as 'unlinked_mismatch'. 0018 auto-relinked to FIS-9850.

select cron.schedule('booking-shipment-auto-link', '*/10 * * * *', 'select public.auto_link_bookings();');

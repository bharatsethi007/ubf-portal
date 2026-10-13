-- Gaps follow the incoterm: only flag charge groups the customer actually pays.
-- Export = customer is seller, Import = customer is buyer. Same rules as src/pages/quotes/quoteResponseGaps.tsx.

create or replace function public.quote_charge_needs(p_incoterm text, p_direction text, p_service text)
returns table(origin boolean, freight boolean, dest boolean) language sql immutable as $$
  with v as (select upper(left(trim(coalesce(p_incoterm, '')), 3)) inc, lower(coalesce(p_direction, '')) dir,
                    lower(coalesce(p_service, '')) svc)
  , c as (select case
    when dir = 'export' and inc in ('FCA','FAS','FOB') then 'YNN'
    when dir = 'export' and inc in ('CFR','CIF','CPT','CIP') then 'YYN'
    when dir = 'export' and inc in ('DAP','DPU','DAT','DDU','DDP') then 'YYY'
    when dir = 'import' and inc = 'EXW' then 'YYY'
    when dir = 'import' and inc in ('FCA','FAS','FOB') then 'NYY'
    when dir = 'import' and inc in ('CFR','CIF','CPT','CIP','DAP','DPU','DAT','DDU','DDP') then 'NNY'
    when svc like '% to %' then
      case when split_part(svc, ' to ', 1) like '%door%' or dir = 'export' then 'Y' else 'N' end || 'Y' ||
      case when split_part(svc, ' to ', 2) like '%door%' or dir = 'import' then 'Y' else 'N' end
    else 'YYY' end k from v)
  select substr(k, 1, 1) = 'Y', substr(k, 2, 1) = 'Y', substr(k, 3, 1) = 'Y'
  from c
$$;

create or replace function public.quote_response_gaps(p_resp uuid)
returns text[] language sql stable security definer set search_path = public as $$
  with q as (select qq.* from public.quote_responses r join public.quotes qq on qq.id = r.quote_id where r.id = p_resp),
       n as (select x.* from q, public.quote_charge_needs(q.incoterms, q.movement_type, q.service_type) x)
  select array_remove(array[
    case when n.origin and not exists (select 1 from public.quote_response_lines where response_id = p_resp and charge_group = 'origin')
         then 'Origin charges missing' end,
    case when n.freight and not exists (select 1 from public.quote_response_lines where response_id = p_resp and charge_group = 'freight')
         then 'Freight charges missing' end,
    case when n.dest and not exists (select 1 from public.quote_response_lines where response_id = p_resp and charge_group in ('dest', 'destination'))
         then 'Destination charges missing' end,
    case when exists (select 1 from public.quote_response_lines where response_id = p_resp and charge_group = 'freight'
                       and coalesce(sell_rate, 0) > 0 and coalesce(buy_rate, 0) = 0)
         then 'Freight buy rate not on file' end
  ], null)
  from n
$$;
revoke all on function public.quote_response_gaps(uuid) from public, anon, authenticated;

update public.quotes q
   set ai_gaps = public.quote_response_gaps(r.id)
  from public.quote_responses r
 where r.quote_id = q.id and r.ai_generated and q.ai_priced_at is not null;

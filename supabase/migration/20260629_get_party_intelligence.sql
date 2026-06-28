-- 20260629_get_party_intelligence.sql
-- LIVE in project cpnkudbdzgnzmodhsrbf (applied via Supabase MCP). Repo record only.
-- Staff-portal RPC powering the UBF Intelligence panel on the bookings screen.
-- Returns per-party: name, recipient email, 12-month volume, open AR, YTD spend, last 5 jobs.
-- Returns null when the party has no data (panel hides that card).

create or replace function public.get_party_intelligence(p_account_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_name text;
  v_email text;
begin
  -- staff-only guard (blocks portal_users / cross-customer access)
  if not exists (select 1 from staff_users where user_id = auth.uid()) then
    raise exception 'not authorised';
  end if;

  select name into v_name from customers where account_id = p_account_id;

  -- recipient: prime contact -> any contact -> customer email; never internal @ubfreight.com
  v_email := coalesce(
    (select email from contacts
       where account_id = p_account_id and is_prime
         and email is not null and email not ilike '%@ubfreight.com%' limit 1),
    (select email from contacts
       where account_id = p_account_id
         and email is not null and email not ilike '%@ubfreight.com%' limit 1),
    (select email from customers
       where account_id = p_account_id
         and email is not null and email not ilike '%@ubfreight.com%')
  );

  select jsonb_build_object(
    'name', v_name,
    'email', v_email,

    -- rolling 12-month volume, grouped by air/sea + direction + destination
    'volume', coalesce((
      select jsonb_agg(jsonb_build_object('mode',mode,'dir',dir,'dest',dest,'count',cnt) order by cnt desc)
      from (
        select case when module in ('FEA','FIA') then 'air' else 'sea' end mode,
               direction dir, coalesce(p.name, s.destination) dest, count(*) cnt
        from shipments s left join ports p on p.code = s.destination
        where s.customer_account_id = p_account_id
          and s.relevant_date >= (current_date - interval '12 months')
        group by 1,2,3
      ) v), '[]'::jsonb),

    -- open AR (positive balances only)
    'due_invoices', coalesce((
      select sum(balance) from invoices where account_id = p_account_id and balance > 0), 0),

    -- YTD spend (this calendar year, local amounts)
    'ytd_spend', coalesce((
      select sum(amt_local) from invoices
      where account_id = p_account_id and doc_date >= date_trunc('year', current_date)), 0),

    -- last 5 shipments -> pills (route + dates only; no status until tracking_events)
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job', s.job_unique,
        'mode', case when s.module in ('FEA','FIA') then 'air' else 'sea' end,
        'dir', s.direction,
        'dest', coalesce(dp.name, s.destination),
        'route', coalesce(op.name, s.origin) || ' -> ' || coalesce(dp.name, s.destination),
        'etd', to_char(s.etd, 'DD Mon YY'),
        'eta', to_char(s.eta, 'DD Mon YY'),
        'date', to_char(s.relevant_date, 'DD Mon'))
        order by s.relevant_date desc)
      from (select * from shipments where customer_account_id = p_account_id
            order by relevant_date desc nulls last limit 5) s
      left join ports op on op.code = s.origin
      left join ports dp on dp.code = s.destination), '[]'::jsonb)
  ) into result;

  -- hide card when nothing to show
  if (result->'volume' = '[]'::jsonb) and (result->'jobs' = '[]'::jsonb)
     and coalesce((result->>'due_invoices')::numeric,0) = 0
     and coalesce((result->>'ytd_spend')::numeric,0) = 0
  then
    return null;
  end if;

  return result;
end;
$$;

grant execute on function public.get_party_intelligence(text) to authenticated;

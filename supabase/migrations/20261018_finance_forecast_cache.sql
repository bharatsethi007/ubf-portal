-- 13-week cash forecast: compute once per company per sync per day, then serve the saved copy.
-- It reads three months of cash batches plus every open item and ran 2-8s depending on load,
-- tipping past the 8s API limit while a sync or report refresh was running.

create table if not exists finance_data.report_cache (
  company_id  text not null,          -- company scope key, eg 'FJ' or 'FJ,NZ' for All companies
  fn          text not null,
  args        text not null,
  stamp       text not null,          -- last finance sync + date; a new sync or a new day recomputes
  data        jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (company_id, fn, args)
);
alter table finance_data.report_cache enable row level security;   -- reached only through definer functions

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'fin_cash_forecast_calc' and pronamespace = 'public'::regnamespace) then
    alter function public.fin_cash_forecast(integer) rename to fin_cash_forecast_calc;
  end if;
end $$;
revoke execute on function public.fin_cash_forecast_calc(integer) from public, anon, authenticated;

create or replace function public.fin_cash_forecast(p_weeks integer default 13)
returns table(week_start date, opening numeric, ar_existing numeric, ap_existing numeric, new_receipts numeric,
              new_payments numeric, payroll numeric, overheads numeric, tax_gst numeric, other numeric, net numeric, closing numeric)
language plpgsql volatile security definer set search_path = finance, scoped, public as $$
declare
  v_key   text := array_to_string(array(select x from public.scope_companies() x order by 1), ',');
  v_stamp text;
  v_data  jsonb;
begin
  perform finance.assert_access();
  select coalesce(max(s.synced_at)::text, '') || '|' || current_date into v_stamp from finance.sync_state s;

  select rc.data into v_data from finance_data.report_cache rc
   where rc.company_id = v_key and rc.fn = 'cash_forecast' and rc.args = p_weeks::text and rc.stamp = v_stamp;

  if v_data is null then
    select coalesce(jsonb_agg(to_jsonb(f) order by f.week_start), '[]'::jsonb) into v_data
      from public.fin_cash_forecast_calc(p_weeks) f;
    insert into finance_data.report_cache (company_id, fn, args, stamp, data)
    values (v_key, 'cash_forecast', p_weeks::text, v_stamp, v_data)
    on conflict (company_id, fn, args) do update
      set stamp = excluded.stamp, data = excluded.data, computed_at = now();
  end if;

  return query
  select x.week_start, x.opening, x.ar_existing, x.ap_existing, x.new_receipts, x.new_payments,
         x.payroll, x.overheads, x.tax_gst, x.other, x.net, x.closing
  from jsonb_to_recordset(v_data) as x(week_start date, opening numeric, ar_existing numeric, ap_existing numeric,
       new_receipts numeric, new_payments numeric, payroll numeric, overheads numeric, tax_gst numeric,
       other numeric, net numeric, closing numeric)
  order by x.week_start;
end $$;

revoke execute on function public.fin_cash_forecast(integer) from public, anon;
grant execute on function public.fin_cash_forecast(integer) to authenticated;
alter function public.fin_cash_forecast(integer) set work_mem = '32MB';

-- Payment-batch lookups in the cash flow lines were scanning the whole ledger
create index if not exists gl_trans_cid_batch on finance_data.gl_trans (company_id, company, batchno);
analyze finance_data.gl_trans;

select public.apply_company_scope();

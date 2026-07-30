-- 20260731_fx_sync.sql  (already applied to production)

create table if not exists public.fx_sync_state (
  id integer primary key default 1,
  last_request_id bigint,
  last_requested_at timestamptz,
  last_applied_at timestamptz,
  last_result text,
  constraint fx_sync_state_singleton check (id = 1)
);
insert into public.fx_sync_state (id) values (1) on conflict (id) do nothing;

alter table public.fx_sync_state enable row level security;
create policy fx_sync_state_staff_read on public.fx_sync_state
  for select using (is_staff());

create or replace function public.fx_request()
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare req_id bigint;
begin
  if auth.uid() is not null and not is_staff() then raise exception 'fx: staff only'; end if;
  select net.http_get('https://open.er-api.com/v6/latest/NZD') into req_id;
  update public.fx_sync_state set last_request_id = req_id, last_requested_at = now() where id = 1;
  return req_id;
end $function$;

create or replace function public.fx_apply()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  req_id bigint; resp record; payload jsonb; rates jsonb;
  base_cur text; quote_cur text; r numeric; n int := 0; msg text;
begin
  if auth.uid() is not null and not is_staff() then raise exception 'fx: staff only'; end if;
  select last_request_id into req_id from public.fx_sync_state where id = 1;
  if req_id is null then return 'fx_apply: no request on record'; end if;
  select * into resp from net._http_response where id = req_id;
  if not found then return 'fx_apply: response not ready yet'; end if;
  if resp.status_code <> 200 then
    msg := 'fx_apply: http ' || resp.status_code;
    update public.fx_sync_state set last_applied_at = now(), last_result = msg where id = 1;
    return msg;
  end if;
  payload := resp.content::jsonb;
  if payload->>'result' <> 'success' then
    msg := 'fx_apply: api not success';
    update public.fx_sync_state set last_applied_at = now(), last_result = msg where id = 1;
    return msg;
  end if;
  rates := payload->'rates';
  for base_cur in select code from public.currencies where active loop
    if rates ? base_cur then
      for quote_cur in select code from public.currencies where active loop
        if rates ? quote_cur then
          r := (rates->>base_cur)::numeric / nullif((rates->>quote_cur)::numeric, 0);
          if r is not null then
            insert into public.exchange_rates (base_currency, quote_currency, rate, as_of, source, updated_at)
            values (base_cur, quote_cur, round(r, 6), current_date, 'open.er-api.com', now())
            on conflict (base_currency, quote_currency) do update
              set rate = excluded.rate, as_of = excluded.as_of, source = excluded.source, updated_at = now();
            n := n + 1;
          end if;
        end if;
      end loop;
    end if;
  end loop;
  msg := 'fx_apply: upserted ' || n || ' pairs';
  update public.fx_sync_state set last_applied_at = now(), last_result = msg where id = 1;
  return msg;
end $function$;

grant execute on function public.fx_request() to authenticated;
grant execute on function public.fx_apply() to authenticated;

-- cron: fx-request-daily '0 18 * * *' -> select public.fx_request();
-- cron: fx-apply-daily   '3 18 * * *' -> select public.fx_apply();

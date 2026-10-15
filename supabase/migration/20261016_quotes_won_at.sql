-- Quotes: won date, sales owner and time to win (16 Oct 2026).
-- 1. won_at column, kept by the status trigger.
-- 2. Backfill from audit_log (last switch to won/crosswin), else updated_at.
-- 3. Leaderboard RPCs gain hrs_to_win (median, created -> won) and a sales block.

alter table public.quotes add column if not exists won_at timestamptz;

create or replace function public.quote_status_bookkeeping()
returns trigger language plpgsql set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status then
    if new.status = 'lost' then
      new.lost_at := coalesce(new.lost_at, now());
    else
      new.lost_reason := null; new.lost_note := null; new.lost_at := null;
      if new.status in ('open','published','sent') and new.expires_at is not null and new.expires_at < now() then
        new.expires_at := now() + interval '30 days';
      end if;
    end if;
    if new.status in ('won','crosswin') then
      -- won -> crosswin keeps the original win date.
      new.won_at := case when old.status in ('won','crosswin') then coalesce(old.won_at, now()) else now() end;
    else
      new.won_at := null;
    end if;
  end if;
  return new;
end $function$;

update public.quotes q
set won_at = coalesce(
  (select max(a.created_at) from public.audit_log a
    where a.quote_id = q.id and a.table_name = 'quotes' and a.op = 'U'
      and a.diff->'status'->>'new' in ('won','crosswin')),
  q.updated_at)
where q.status in ('won','crosswin') and q.won_at is null;

create index if not exists quotes_won_at_idx on public.quotes (won_at) where won_at is not null;

-- Patch the leaderboard RPC bodies in place (keeps everything else identical).
do $patch$
declare
  d text;
  n text;
  win text := 'round((percentile_cont(0.5) within group (order by extract(epoch from %1$swon_at - %1$screated_at) / 3600.0) filter (where %1$swon_at is not null))::numeric, 1)';
begin
  -- quotes_leaderboard
  select pg_get_functiondef('public.quotes_leaderboard(text,text)'::regprocedure) into d;
  if position('hrs_to_win' in d) = 0 then
    n := replace(d, 'x.lost_reason,', 'x.lost_reason, x.won_at, x.sales_executive_id,');
    n := replace(n, '::int as email_matched', '::int as email_matched,' || chr(10) || '      ' || format(win, 'q.') || ' as hrs_to_win');
    n := replace(n, 'max(q.created_at) as last_quote', format(win, 'q.') || ' as hrs_to_win,' || chr(10) || '      max(q.created_at) as last_quote');
    n := replace(n, '''customers'', count(distinct', '''hrs_to_win'', ' || format(win, '') || ',' || chr(10) || '        ''customers'', count(distinct');
    n := replace(n, '''mix'', jsonb_build_object(', $s$'sales', coalesce((select jsonb_agg(jsonb_build_object('user_id', uid, 'name', nm, 'won', w, 'hrs_to_win', h, 'last_won', lw) order by w desc, nm) from (
        select case when q.is_agent then null else q.sales_executive_id end as uid,
               case when q.is_agent then 'Agent quote'
                    else coalesce(nullif(su.full_name, ''), nullif(trim(coalesce(su.first_name,'') || ' ' || coalesce(su.last_name,'')), ''), su.email, 'Unassigned') end as nm,
               count(*)::int as w,
               round((percentile_cont(0.5) within group (order by extract(epoch from q.won_at - q.created_at) / 3600.0))::numeric, 1) as h,
               max(q.won_at) as lw
        from q left join staff_users su on su.user_id = q.sales_executive_id and not q.is_agent
        where q.status in ('won','crosswin')
        group by 1, 2) t), '[]'::jsonb),
    'mix', jsonb_build_object($s$);
    if (length(n) - length(replace(n, 'hrs_to_win', ''))) / length('hrs_to_win') < 4 then
      raise exception 'quotes_leaderboard patch anchors not found';
    end if;
    execute n;
  end if;

  -- quotes_leaderboard_agents
  select pg_get_functiondef('public.quotes_leaderboard_agents(text,text)'::regprocedure) into d;
  if position('hrs_to_win' in d) = 0 then
    n := replace(d, 'select x.id, x.status, x.created_at,', 'select x.id, x.status, x.created_at, x.won_at,');
    n := replace(n, 'max(created_at) as last_quote', format(win, '') || ' as hrs_to_win,' || chr(10) || '      max(created_at) as last_quote');
    if position('x.won_at' in n) = 0 or position('hrs_to_win' in n) = 0 then
      raise exception 'quotes_leaderboard_agents patch anchors not found';
    end if;
    execute n;
  end if;
end
$patch$;

-- Quotes: new status 'held' (customer paused, no expiry, no reminders) and
-- direction 'crosstrade' (cargo moves between ports where UBF has no office).
-- Leaderboards gain held counts, a Held slice and a "Cross trade" direction label.
-- expire_quotes, reminders, approvals and tower actions already filter on
-- open/published/sent, so held quotes are skipped there with no change.

alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status = any (array['open','published','sent','held','won','lost','crosswin']));

do $mig$
declare d text; n text;
begin
  -- quotes_leaderboard
  d := pg_get_functiondef('public.quotes_leaderboard(text,text)'::regprocedure);
  if position('''held''' in d) = 0 then
    n := replace(d,
      $a$initcap(coalesce(nullif(x.movement_type, ''), 'unknown')) as direction$a$,
      $b$case lower(coalesce(x.movement_type, '')) when 'crosstrade' then 'Cross trade' when '' then 'Unknown' else initcap(x.movement_type) end as direction$b$);
    n := replace(n,
      $a$count(*) filter (where q.status = 'open')::int as open,$a$,
      $b$count(*) filter (where q.status = 'open')::int as open,
      count(*) filter (where q.status = 'held')::int as held,$b$);
    n := replace(n,
      $a$'quotes', count(*), 'open', count(*) filter (where status = 'open'),$a$,
      $b$'quotes', count(*), 'open', count(*) filter (where status = 'open'), 'held', count(*) filter (where status = 'held'),$b$);
    n := replace(n,
      $a$when 'lost' then 'Lost' else 'Open' end$a$,
      $b$when 'lost' then 'Lost' when 'held' then 'Held' else 'Open' end$b$);
    if n = d or position('Cross trade' in n) = 0 or position('''Held''' in n) = 0 then
      raise exception 'quotes_leaderboard: patch anchors not found';
    end if;
    execute n;
  end if;

  -- quotes_leaderboard_agents
  d := pg_get_functiondef('public.quotes_leaderboard_agents(text,text)'::regprocedure);
  if position('''held''' in d) = 0 then
    n := replace(d,
      $a$count(*) filter (where status = 'open')::int as open,$a$,
      $b$count(*) filter (where status = 'open')::int as open,
      count(*) filter (where status = 'held')::int as held,$b$);
    if n = d then raise exception 'quotes_leaderboard_agents: patch anchor not found'; end if;
    execute n;
  end if;
end
$mig$;

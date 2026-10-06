-- inbox_get: include attachment id so staff can save picked files to a job.
do $$
declare d text := pg_get_functiondef('public.inbox_get'::regproc);
begin
  if position('''id'', a.id' in d) = 0 then
    d := replace(d, 'jsonb_build_object(''name'', a.name,', 'jsonb_build_object(''id'', a.id, ''name'', a.name,');
    execute d;
  end if;
end $$;

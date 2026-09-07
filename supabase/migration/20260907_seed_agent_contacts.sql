-- 20260907_seed_agent_contacts.sql
-- do not re-run, applied via MCP (idempotent NOT EXISTS guard, safe if re-run)
insert into public.agent_contacts (agent_id, name, role, email, is_prime)
select a.id,
       coalesce(nullif(btrim(coalesce(ct.first_name,'') || '' '' || coalesce(ct.last_name,'')),''), c.name, a.name) as name,
       'primary' as role,
       lower(coalesce(nullif(ct.email,''), c.email)) as email,
       true as is_prime
from public.agents a
join public.customers c on c.account_id = a.erp_account_code
left join lateral (
  select first_name, last_name, email
  from public.contacts
  where account_id = a.erp_account_code and email <> ''
  order by is_prime desc nulls last, id
  limit 1
) ct on true
where coalesce(nullif(ct.email,''), nullif(c.email,'')) is not null
  and not exists (
    select 1 from public.agent_contacts x
    where x.agent_id = a.id
      and lower(x.email) = lower(coalesce(nullif(ct.email,''), c.email))
  );

-- Applied live via MCP 1 Oct 2026 (migration create_portal_agent_rpc). Idempotent (create or replace).
-- Quick-add an overseas agent from the quote screen: agent (source 'prospect', Agents section)
-- plus a linked P-xxxxx customers row (erp_account_code) so quotes can be raised straight away.
create or replace function public.create_portal_agent(
  p_name text, p_country text default null,
  p_contact text default null, p_email text default null, p_phone text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_name text := upper(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
  v_dup text;
  v_code text;
  v_agent uuid;
begin
  if not is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(v_name) < 2 then raise exception 'Agent name is required'; end if;

  select coalesce(erp_account_code, id::text) into v_dup from agents
   where upper(btrim(name)) = v_name and status <> 'inactive' limit 1;
  if v_dup is not null then
    raise exception 'Agent already exists (%)', v_dup using errcode = '23505';
  end if;

  v_code := 'P-' || lpad(nextval('portal_customer_seq')::text, 5, '0');

  insert into customers (account_id, name, email, phone, contact, country, closed, source, created_by, created_at, synced_at)
  values (v_code, v_name, nullif(lower(btrim(p_email)), ''), nullif(btrim(p_phone), ''), nullif(btrim(p_contact), ''),
          nullif(upper(btrim(p_country)), ''), false, 'portal', auth.uid(), now(), null);

  insert into agents (erp_account_code, name, country, source, status)
  values (v_code, v_name, nullif(upper(btrim(p_country)), ''), 'prospect', 'active')
  returning id into v_agent;

  if nullif(btrim(p_contact), '') is not null or nullif(btrim(p_email), '') is not null then
    insert into agent_contacts (agent_id, name, email, phone, is_prime, created_by)
    values (v_agent, coalesce(nullif(btrim(p_contact), ''), v_name), nullif(lower(btrim(p_email)), ''),
            nullif(btrim(p_phone), ''), true, auth.uid());
  end if;

  return jsonb_build_object('account_id', v_code, 'agent_id', v_agent, 'name', v_name,
                            'country', nullif(upper(btrim(p_country)), ''),
                            'email', nullif(lower(btrim(p_email)), ''), 'phone', nullif(btrim(p_phone), ''),
                            'contact', nullif(btrim(p_contact), ''));
end
$fn$;

revoke all on function public.create_portal_agent(text, text, text, text, text) from public, anon;
grant execute on function public.create_portal_agent(text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';

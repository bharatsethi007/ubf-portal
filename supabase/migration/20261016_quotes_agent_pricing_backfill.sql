-- Agent quotes + pricing owner backfill (16 Oct 2026).
-- 1. Quotes whose account is a registered agent become agent quotes (27 rows).
update public.quotes q
set agent_id = a.id, agent_name = a.name
from public.agents a
where a.erp_account_code = q.customer_account_id
  and q.agent_id is null;

-- 2. Agent quotes have no sales owner.
update public.quotes set sales_executive_id = null
where agent_id is not null and sales_executive_id is not null;

-- 3. Pricing owner defaults to the creator (70 rows).
update public.quotes set pricing_executive_id = created_by
where pricing_executive_id is null and created_by is not null;

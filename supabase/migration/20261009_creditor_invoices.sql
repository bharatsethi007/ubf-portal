-- Creditor invoices on bookings (Phase 3). Applied 9 Oct 2026. Repo parity: do not re-run.

-- Approver permission: finance + admin roles.
insert into app_modules (key, label, is_active, sort_order) values ('creditor_approve', 'Approve creditor invoices', true, 96)
  on conflict (key) do nothing;
insert into role_permissions (role_id, module_key, can_read, can_add, can_edit, can_delete)
  select r.id, 'creditor_approve', true, true, true, false from roles r where r.key in ('admin', 'finance')
  on conflict do nothing;

insert into document_tags (name, is_system)
  select v, true from (values ('Creditor Invoice'), ('Creditor Invoice (Approved)')) t(v)
  where not exists (select 1 from document_tags d where d.name = t.v);

create table if not exists public.creditor_invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  document_id uuid references public.booking_documents(id) on delete set null,
  stamped_document_id uuid references public.booking_documents(id) on delete set null,
  vendor_name text,
  cost_type text,
  invoice_no text,
  invoice_date date,
  due_date date,
  currency text not null default 'NZD',
  subtotal numeric,
  tax numeric,
  total numeric,
  fx_rate numeric not null default 1,
  total_nzd numeric generated always as (round(coalesce(total, 0) * fx_rate, 2)) stored,
  references_found text[],
  extracted jsonb,
  ai_status text not null default 'pending' check (ai_status in ('pending','reading','read','failed','manual')),
  ai_error text,
  check_result jsonb,
  status text not null default 'received' check (status in ('received','approved','disputed')),
  pay_by date,
  urgent boolean not null default false,
  approval_comment text,
  approved_by uuid references public.staff_users(user_id),
  approved_by_name text,
  approved_at timestamptz,
  dispute_reason text,
  disputed_by uuid references public.staff_users(user_id),
  disputed_at timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.staff_users(user_id),
  needs_restamp boolean not null default false,
  version int not null default 1,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creditor_invoices_booking_idx on public.creditor_invoices(booking_id);
create index if not exists creditor_invoices_status_idx on public.creditor_invoices(status, pay_by);

create table if not exists public.creditor_invoice_events (
  id bigserial primary key,
  invoice_id uuid not null references public.creditor_invoices(id) on delete cascade,
  booking_id uuid not null,
  action text not null,
  detail jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists creditor_invoice_events_inv_idx on public.creditor_invoice_events(invoice_id, id);

alter table public.creditor_invoices enable row level security;
alter table public.creditor_invoice_events enable row level security;
drop policy if exists ci_staff_all on public.creditor_invoices;
create policy ci_staff_all on public.creditor_invoices for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists cie_staff_read on public.creditor_invoice_events;
create policy cie_staff_read on public.creditor_invoice_events for select to authenticated using (is_staff());
grant select, insert, update, delete on public.creditor_invoices to authenticated;
grant select on public.creditor_invoice_events to authenticated;

-- Event logger: invoice event + booking job audit trail.
create or replace function public.ci_log(p_inv uuid, p_action text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_b uuid; v_uid uuid := auth.uid(); v_name text; v_label text;
begin
  select booking_id, concat_ws(' ', vendor_name, invoice_no) into v_b, v_label from creditor_invoices where id = p_inv;
  select email into v_name from staff_users where user_id = v_uid;
  insert into creditor_invoice_events (invoice_id, booking_id, action, detail, actor_id, actor_name)
  values (p_inv, v_b, p_action, p_detail, case when v_name is null then null else v_uid end, coalesce(v_name, 'system'));
  insert into booking_history (booking_id, field, old_value, new_value, action, actor_id, actor_name)
  values (v_b, 'creditor_invoice', null, left(concat_ws(' · ', nullif(v_label, ''), p_detail::text), 500),
          'creditor_' || p_action, case when v_name is null then null else v_uid end, coalesce(v_name, 'system'));
end $$;

create or replace function public.ci_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := '{}'; k text;
  watched text[] := array['vendor_name','invoice_no','invoice_date','due_date','currency','subtotal','tax','total','pay_by','urgent','approval_comment','cost_type'];
begin
  if tg_op = 'DELETE' then
    if old.status = 'approved' then raise exception 'Approved invoices cannot be deleted'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then return new; end if;
  new.updated_at := now();
  if new.status = 'approved' and old.status is distinct from 'approved' and not has_perm('creditor_approve', 'edit') then
    raise exception 'You do not have permission to approve creditor invoices';
  end if;
  if old.status = 'approved' and new.status = 'approved' then
    for k in select unnest(watched) loop
      if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
        d := d || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k));
      end if;
    end loop;
    if d <> '{}' then
      new.version := old.version + 1;
      new.needs_restamp := true;
      perform ci_log(new.id, 'modified', d);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_ci_guard_u on public.creditor_invoices;
drop trigger if exists trg_ci_guard_d on public.creditor_invoices;
create trigger trg_ci_guard_u before update on public.creditor_invoices for each row execute function public.ci_guard();
create trigger trg_ci_guard_d before delete on public.creditor_invoices for each row execute function public.ci_guard();

create or replace function public.ci_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform ci_log(new.id, 'received', jsonb_build_object('document_id', new.document_id));
  return new;
end $$;
drop trigger if exists trg_ci_after_insert on public.creditor_invoices;
create trigger trg_ci_after_insert after insert on public.creditor_invoices for each row execute function public.ci_after_insert();

-- Deterministic check: invoice vs expected booking_costs for the same vendor. Tolerance NZD 10 or 2%.
create or replace function public.creditor_invoice_check(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare i creditor_invoices%rowtype; b bookings%rowtype; v_exp_nzd numeric; v_exp_native numeric; v_ccys text[];
  v_ids uuid[]; v_inv numeric; v_exp numeric; v_diff numeric; v_tol numeric; v_verdict text; v_reasons text[] := '{}';
  v_dup int; v_refs text[]; v_res jsonb; v_basis text;
begin
  if not is_staff() and auth.uid() is not null then raise exception 'Staff only'; end if;
  select * into i from creditor_invoices where id = p_id;
  select * into b from bookings where id = i.booking_id;

  select coalesce(sum(c.amount_nzd), 0), coalesce(sum(c.amount), 0), array_agg(distinct c.currency), array_agg(c.id)
    into v_exp_nzd, v_exp_native, v_ccys, v_ids
  from booking_costs c
  where c.booking_id = i.booking_id
    and ( (i.vendor_name is not null and c.vendor_name is not null
           and (similarity(lower(c.vendor_name), lower(i.vendor_name)) > 0.3
             or lower(i.vendor_name) like '%' || lower(c.vendor_name) || '%'
             or lower(c.vendor_name) like '%' || lower(i.vendor_name) || '%'))
       or (i.cost_type is not null and c.cost_type = i.cost_type and c.vendor_name is null) );

  if i.total is null then
    v_verdict := 'unread'; v_reasons := array['Invoice total not read yet'];
  elsif v_ids is null or v_ids[1] is null then
    v_verdict := 'no_expected'; v_reasons := array['No expected cost for this vendor on the booking'];
  else
    if v_ccys = array[i.currency] then
      v_basis := i.currency; v_inv := i.total; v_exp := v_exp_native;
      v_tol := greatest(10 / nullif(i.fx_rate, 0), 0.02 * abs(v_exp));
    else
      v_basis := 'NZD'; v_inv := i.total_nzd; v_exp := v_exp_nzd; v_tol := greatest(10, 0.02 * abs(v_exp));
    end if;
    v_diff := round(v_inv - v_exp, 2);
    if abs(v_diff) <= v_tol then v_verdict := 'ok';
    elsif v_diff > 0 then v_verdict := 'over'; v_reasons := v_reasons || format('Invoice is %s %s over expected', v_basis, v_diff);
    else v_verdict := 'under'; v_reasons := v_reasons || format('Invoice is %s %s under expected. Check for missing charges.', v_basis, abs(v_diff));
    end if;
  end if;

  select count(*) into v_dup from creditor_invoices o
  where o.id <> i.id and i.invoice_no is not null and lower(o.invoice_no) = lower(i.invoice_no)
    and similarity(lower(coalesce(o.vendor_name, '')), lower(coalesce(i.vendor_name, ''))) > 0.5;
  if v_dup > 0 then v_reasons := v_reasons || 'Same invoice number already entered (possible duplicate)'::text; v_verdict := 'duplicate'; end if;

  v_refs := array_remove(array[b.mbl_no, b.job_no, b.booking_ref], null)
    || coalesce((select array_agg(container_no) from booking_containers where booking_id = b.id and container_no is not null), '{}');
  if i.references_found is not null and array_length(v_refs, 1) > 0 and not exists (
       select 1 from unnest(i.references_found) f, unnest(v_refs) r
       where upper(regexp_replace(f, '\s', '', 'g')) like '%' || upper(regexp_replace(r, '\s', '', 'g')) || '%') then
    v_reasons := v_reasons || 'No booking reference (MBL, job, container) found on invoice'::text;
    if v_verdict = 'ok' then v_verdict := 'check_ref'; end if;
  end if;

  v_res := jsonb_build_object('verdict', v_verdict, 'basis', v_basis, 'invoice', v_inv, 'expected', v_exp,
    'diff', v_diff, 'tolerance', round(coalesce(v_tol, 0), 2), 'reasons', to_jsonb(v_reasons),
    'matched_cost_ids', to_jsonb(coalesce(v_ids, '{}')), 'checked_at', now());
  update creditor_invoices set check_result = v_res where id = p_id;
  return v_res;
end $$;

create or replace function public.creditor_invoice_approve(p_id uuid, p_pay_by date, p_urgent boolean, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not has_perm('creditor_approve', 'edit') then raise exception 'You do not have permission to approve creditor invoices'; end if;
  if p_pay_by is null then raise exception 'Pay-by date required'; end if;
  select email into v_name from staff_users where user_id = auth.uid();
  update creditor_invoices set status = 'approved', pay_by = p_pay_by, urgent = coalesce(p_urgent, false),
    approval_comment = nullif(trim(p_comment), ''), approved_by = auth.uid(), approved_by_name = v_name,
    approved_at = now(), dispute_reason = null, needs_restamp = true
  where id = p_id and status <> 'approved';
  if not found then raise exception 'Invoice not found or already approved'; end if;
  perform ci_log(p_id, 'approved', jsonb_build_object('pay_by', p_pay_by, 'urgent', p_urgent, 'comment', p_comment));
end $$;

create or replace function public.creditor_invoice_dispute(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason required'; end if;
  update creditor_invoices set status = 'disputed', dispute_reason = trim(p_reason), disputed_by = auth.uid(), disputed_at = now()
  where id = p_id and status <> 'approved';
  if not found then raise exception 'Approved invoices cannot be disputed. Modify instead.'; end if;
  perform ci_log(p_id, 'disputed', jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.creditor_invoice_reopen(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  update creditor_invoices set status = 'received' where id = p_id and status = 'disputed';
  if not found then raise exception 'Only disputed invoices can be reopened'; end if;
  perform ci_log(p_id, 'reopened', null);
end $$;

create or replace function public.creditor_invoice_set_stamped(p_id uuid, p_document_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  update creditor_invoices set stamped_document_id = p_document_id, needs_restamp = false where id = p_id and status = 'approved';
  if not found then raise exception 'Only approved invoices can be stamped'; end if;
  perform ci_log(p_id, 'stamped', jsonb_build_object('document_id', p_document_id));
end $$;

create or replace function public.creditor_invoice_mark_sent(p_id uuid, p_to text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  update creditor_invoices set sent_at = now(), sent_by = auth.uid() where id = p_id;
  perform ci_log(p_id, 'sent', jsonb_build_object('to', p_to));
end $$;

revoke all on function public.ci_log(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.ci_log(uuid, text, jsonb) to service_role;
grant execute on function public.creditor_invoice_check(uuid) to service_role;
revoke all on function public.creditor_invoice_check(uuid), public.creditor_invoice_approve(uuid, date, boolean, text),
  public.creditor_invoice_dispute(uuid, text), public.creditor_invoice_reopen(uuid),
  public.creditor_invoice_set_stamped(uuid, uuid), public.creditor_invoice_mark_sent(uuid, text) from public, anon;
grant execute on function public.creditor_invoice_check(uuid), public.creditor_invoice_approve(uuid, date, boolean, text),
  public.creditor_invoice_dispute(uuid, text), public.creditor_invoice_reopen(uuid),
  public.creditor_invoice_set_stamped(uuid, uuid), public.creditor_invoice_mark_sent(uuid, text) to authenticated;

notify pgrst, 'reload schema';

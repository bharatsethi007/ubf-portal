-- APPLIED LIVE 5 Oct 2026 via MCP. Repo parity only. DO NOT RE-RUN.
-- 1) portal_notifications kind check: add gated_out, task_assigned.
-- 2) v_container_dates: ETA falls back to ERP shipments (arrived, eta); stale past estimates show 'unknown'.
alter table public.portal_notifications drop constraint if exists portal_notifications_kind_check;
alter table public.portal_notifications add constraint portal_notifications_kind_check check (kind = any (array[
  'shipment_created','eta_changed','departed','arrived','released','invoice_issued','message','quote_ready','document_shared',
  'gated_out','task_assigned']));
-- v_container_dates body: see live DB (select pg_get_viewdef('public.v_container_dates')).
notify pgrst, 'reload schema';

-- 20260629_get_booking_meta.sql
-- LIVE in project cpnkudbdzgnzmodhsrbf (applied via Supabase MCP). Repo record only.
-- Single source of truth: maps a booking module to a human mode label and the
-- internal UBF ops mailbox. Used by the UBF Intelligence "Draft confirmation" CTA.

create or replace function public.get_booking_meta(p_module text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'mode_label', case p_module
      when 'EA' then 'Air export'  when 'FEA' then 'Air export'
      when 'ES' then 'Sea export'  when 'FES' then 'Sea export'
      when 'IA' then 'Air import'  when 'FIA' then 'Air import'
      when 'IS' then 'Sea import'  when 'FIS' then 'Sea import'
      else 'Shipment' end,
    'ops_mailbox', case p_module
      when 'EA' then 'exportair.nz@ubfreight.com'  when 'FEA' then 'exportair.nz@ubfreight.com'
      when 'ES' then 'exportsea.nz@ubfreight.com'  when 'FES' then 'exportsea.nz@ubfreight.com'
      when 'IA' then 'importair.nz@ubfreight.com'  when 'FIA' then 'importair.nz@ubfreight.com'
      when 'IS' then 'importsea.nz@ubfreight.com'  when 'FIS' then 'importsea.nz@ubfreight.com'
      else 'info.nz@ubfreight.com' end
  );
$$;

grant execute on function public.get_booking_meta(text) to authenticated;

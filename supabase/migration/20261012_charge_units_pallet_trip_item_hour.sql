-- APPLIED 12 Oct 2026 via MCP. Idempotent.
insert into public.charge_units (code, label, sort_order, active, modes) values
  ('per_pallet', 'Per Pallet', 112, true, array['air','sea']),
  ('per_item',   'Per Item',   114, true, array['air','sea']),
  ('per_trip',   'Per Trip',   116, true, array['air','sea']),
  ('per_hour',   'Per Hour',   118, true, array['air','sea'])
on conflict (code) do nothing;
notify pgrst, 'reload schema';

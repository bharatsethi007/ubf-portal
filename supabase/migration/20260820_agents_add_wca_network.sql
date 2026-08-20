insert into public.freight_networks (code, name, sort_order) values ('WCA', 'WCA World', 15) on conflict (code) do nothing;
notify pgrst, 'reload schema';

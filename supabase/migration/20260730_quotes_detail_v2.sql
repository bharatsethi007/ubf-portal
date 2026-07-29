-- 1. New container size set: 20ft, 20ft HC, 40ft, 40ft HC  (values 20 / 20HC / 40 / 40HC)
update public.quote_containers set container_size = '40HC' where container_size = '45HC';

do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.quote_containers'::regclass
     and pg_get_constraintdef(oid) ilike '%container_size%';
  if c is not null then
    execute format('alter table public.quote_containers drop constraint %I', c);
  end if;
end $$;

alter table public.quote_containers
  add constraint quote_containers_container_size_check
  check (container_size in ('20','20HC','40','40HC'));

-- 2. Quote-level additions
alter table public.quotes
  add column if not exists cargo_currency   text default 'NZD',
  add column if not exists shipper_address   text,
  add column if not exists consignee_address text,
  add column if not exists reefer_temp_c     numeric,
  add column if not exists dg_un_number      text,
  add column if not exists dg_class          text;

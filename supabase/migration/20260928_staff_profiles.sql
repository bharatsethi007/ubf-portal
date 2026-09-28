-- Staff profiles: names, branch, manager, avatar, active flag.
alter table public.staff_users
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists branch text,
  add column if not exists manager_id uuid references public.staff_users(user_id) on delete set null,
  add column if not exists avatar_path text,
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz;

alter table public.staff_users drop constraint if exists staff_users_manager_not_self;
alter table public.staff_users add constraint staff_users_manager_not_self check (manager_id is null or manager_id <> user_id);

-- Backfill names from full_name where present.
update public.staff_users
   set first_name = split_part(full_name, ' ', 1),
       last_name  = nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), '')
 where full_name is not null and first_name is null;

-- Keep full_name + initials in sync with first/last.
create or replace function public.staff_users_sync_names() returns trigger
language plpgsql as $$
begin
  if new.first_name is not null or new.last_name is not null then
    new.full_name := nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '');
    new.initials  := nullif(upper(concat(left(coalesce(new.first_name, ''), 1), left(coalesce(new.last_name, ''), 1))), '');
  end if;
  return new;
end $$;
drop trigger if exists trg_staff_users_sync_names on public.staff_users;
create trigger trg_staff_users_sync_names before insert or update of first_name, last_name on public.staff_users
  for each row execute function public.staff_users_sync_names();

-- Inactive staff lose all access immediately.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists(select 1 from staff_users where user_id = auth.uid() and is_active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select su.is_admin from staff_users su where su.user_id = auth.uid() and su.is_active), false);
$$;

create or replace function public.has_perm(p_module text, p_op text) returns boolean
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean;
  v_ovr   boolean;
  v_role  boolean;
begin
  if v_uid is null then return false; end if;
  select su.is_admin into v_admin from staff_users su where su.user_id = v_uid and su.is_active;
  if v_admin is null then return false; end if;   -- not an active staff user
  if v_admin then return true; end if;
  select case p_op when 'read' then o.can_read when 'add' then o.can_add
                   when 'edit' then o.can_edit when 'delete' then o.can_delete else null end
    into v_ovr
  from user_permission_overrides o where o.user_id = v_uid and o.module_key = p_module;
  if v_ovr is not null then return v_ovr; end if;
  select coalesce(bool_or(case p_op when 'read' then rp.can_read when 'add' then rp.can_add
                   when 'edit' then rp.can_edit when 'delete' then rp.can_delete else false end), false)
    into v_role
  from staff_user_roles sur
  join roles r on r.id = sur.role_id and r.is_active
  join role_permissions rp on rp.role_id = sur.role_id and rp.module_key = p_module
  where sur.user_id = v_uid;
  return coalesce(v_role, false);
end $$;

-- Profile update. Self can edit name, title, photo. Users-edit permission can edit everything.
create or replace function public.update_staff_profile(
  p_user_id uuid, p_first_name text, p_last_name text, p_job_title text,
  p_branch text default null, p_manager_id uuid default null, p_avatar_path text default null,
  p_set_org boolean default false
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_self boolean := p_user_id = auth.uid(); v_mgr boolean := has_perm('users', 'edit');
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if not v_self and not v_mgr then raise exception 'You do not have permission to edit this user.'; end if;
  if p_set_org and not v_mgr then raise exception 'You do not have permission to change branch or manager.'; end if;
  if p_manager_id = p_user_id then raise exception 'A user cannot be their own manager.'; end if;

  update staff_users set
    first_name  = nullif(trim(p_first_name), ''),
    last_name   = nullif(trim(p_last_name), ''),
    job_title   = nullif(trim(p_job_title), ''),
    avatar_path = case when p_avatar_path is null then avatar_path else nullif(p_avatar_path, '') end,  -- '' clears
    branch      = case when p_set_org then nullif(trim(p_branch), '') else branch end,
    manager_id  = case when p_set_org then p_manager_id else manager_id end
  where user_id = p_user_id;
end $$;
revoke all on function public.update_staff_profile(uuid, text, text, text, text, uuid, text, boolean) from public, anon;
grant execute on function public.update_staff_profile(uuid, text, text, text, text, uuid, text, boolean) to authenticated;

-- Avatar storage: public read, write own folder (or users-edit permission).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.is_staff()
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_perm('users', 'edit')));
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.is_staff()
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_perm('users', 'edit')));
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_staff()
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_perm('users', 'edit')));

import { supabase } from '../../supabase'

export type AppModule = { key: string; label: string; sort_order: number }
export type Role = {
  id: string; key: string | null; name: string; description: string | null
  is_preset: boolean; is_active: boolean
}
export type RolePerm = {
  module_key: string; can_read: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean
}
export type StaffWithRoles = {
  user_id: string; email: string | null; initials: string | null; is_admin: boolean
  roles: { id: string; name: string }[]
}
export type OverrideCell = {
  can_read: boolean | null; can_add: boolean | null; can_edit: boolean | null; can_delete: boolean | null
}
export type UserOverride = { module_key: string } & OverrideCell

export async function listModules(): Promise<AppModule[]> {
  const { data, error } = await supabase.from('app_modules')
    .select('key,label,sort_order').eq('is_active', true).order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function listRoles(): Promise<Role[]> {
  const { data, error } = await supabase.from('roles')
    .select('id,key,name,description,is_preset,is_active')
    .order('is_preset', { ascending: false }).order('name')
  if (error) throw error
  return data ?? []
}

export async function getRolePermissions(roleId: string): Promise<RolePerm[]> {
  const { data, error } = await supabase.from('role_permissions')
    .select('module_key,can_read,can_add,can_edit,can_delete').eq('role_id', roleId)
  if (error) throw error
  return data ?? []
}

export async function createRole(input: { name: string; description?: string }): Promise<Role> {
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('roles')
    .insert({ name: input.name, description: input.description ?? null, is_preset: false, created_by: auth.user?.id ?? null })
    .select('id,key,name,description,is_preset,is_active').single()
  if (error) throw error
  return data
}

export async function updateRole(
  id: string, patch: { name?: string; description?: string | null; is_active?: boolean },
): Promise<void> {
  const { error } = await supabase.from('roles').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', id)
  if (error) throw error
}

export async function saveRolePermissions(roleId: string, rows: RolePerm[]): Promise<void> {
  const payload = rows.map((r) => ({ role_id: roleId, ...r }))
  const { error } = await supabase.from('role_permissions')
    .upsert(payload, { onConflict: 'role_id,module_key' })
  if (error) throw error
}

type StaffRow = {
  user_id: string; email: string | null; initials: string | null; is_admin: boolean
  staff_user_roles: { roles: { id: string; name: string } | null }[] | null
}
export async function listStaffWithRoles(): Promise<StaffWithRoles[]> {
  const { data, error } = await supabase.from('staff_users')
    .select('user_id,email,initials,is_admin,staff_user_roles(roles(id,name))')
    .order('email')
  if (error) throw error
  return ((data ?? []) as unknown as StaffRow[]).map((s) => ({
    user_id: s.user_id, email: s.email, initials: s.initials, is_admin: s.is_admin,
    roles: (s.staff_user_roles ?? [])
      .map((sr) => sr.roles)
      .filter((r): r is { id: string; name: string } => !!r),
  }))
}

export async function getUserRoleIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('staff_user_roles').select('role_id').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((r) => r.role_id as string)
}

export async function assignRole(userId: string, roleId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('staff_user_roles')
    .upsert({ user_id: userId, role_id: roleId, assigned_by: auth.user?.id ?? null }, { onConflict: 'user_id,role_id' })
  if (error) throw error
}

export async function unassignRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabase.from('staff_user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
  if (error) throw error
}

export async function getUserOverrides(userId: string): Promise<UserOverride[]> {
  const { data, error } = await supabase.from('user_permission_overrides')
    .select('module_key,can_read,can_add,can_edit,can_delete').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((r) => ({
    module_key: r.module_key as string,
    can_read: r.can_read as boolean | null,
    can_add: r.can_add as boolean | null,
    can_edit: r.can_edit as boolean | null,
    can_delete: r.can_delete as boolean | null,
  }))
}

export async function upsertUserOverride(userId: string, moduleKey: string, cell: OverrideCell): Promise<void> {
  const allInherit = cell.can_read === null && cell.can_add === null && cell.can_edit === null && cell.can_delete === null
  if (allInherit) { await deleteUserOverride(userId, moduleKey); return }
  const { error } = await supabase.from('user_permission_overrides')
    .upsert({ user_id: userId, module_key: moduleKey, ...cell }, { onConflict: 'user_id,module_key' })
  if (error) throw error
}

export async function deleteUserOverride(userId: string, moduleKey: string): Promise<void> {
  const { error } = await supabase.from('user_permission_overrides')
    .delete().eq('user_id', userId).eq('module_key', moduleKey)
  if (error) throw error
}

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

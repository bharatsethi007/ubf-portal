import { supabase } from '../../supabase'

// Hardcoded for now. Move to a table when branches need managing.
export const BRANCHES = ['New Zealand', 'Australia', 'Fiji'] as const

export type StaffProfile = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  job_title: string | null
  branch: string | null
  manager_id: string | null
  avatar_path: string | null
  is_active: boolean
  is_admin: boolean
}

export const PROFILE_COLS = 'user_id,email,first_name,last_name,job_title,branch,manager_id,avatar_path,is_active,is_admin'

/** Broadcast so the top bar reloads name/photo after any profile edit. */
export const PROFILE_CHANGED = 'staff-profile-changed'
export function notifyProfileChanged() { window.dispatchEvent(new Event(PROFILE_CHANGED)) }

export function displayName(p: Pick<StaffProfile, 'first_name' | 'last_name' | 'email'>): string {
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return n || p.email?.split('@')[0] || 'Staff'
}

export function avatarUrl(path: string | null): string | null {
  if (!path) return null
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function getStaffProfile(userId: string): Promise<StaffProfile | null> {
  const { data, error } = await supabase.from('staff_users').select(PROFILE_COLS).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as StaffProfile | null
}

export async function listActiveStaff(): Promise<StaffProfile[]> {
  const { data, error } = await supabase.from('staff_users').select(PROFILE_COLS).eq('is_active', true).order('first_name')
  if (error) throw error
  return (data ?? []) as StaffProfile[]
}

export type ProfilePatch = {
  first_name: string; last_name: string; job_title: string
  branch?: string; manager_id?: string | null; avatar_path?: string | null
}
export async function updateStaffProfile(userId: string, p: ProfilePatch, setOrg: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_staff_profile', {
    p_user_id: userId, p_first_name: p.first_name, p_last_name: p.last_name, p_job_title: p.job_title,
    p_branch: p.branch ?? null, p_manager_id: p.manager_id || null, p_avatar_path: p.avatar_path ?? null, p_set_org: setOrg,
  })
  if (error) throw new Error(error.message)
  notifyProfileChanged()
}

/** Crops to a centred square, resizes to 256px JPEG, uploads, returns storage path. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 256
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256)
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Image failed'))), 'image/jpeg', 0.88))
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(error.message)
  return path
}

export async function removeAvatarFile(path: string | null): Promise<void> {
  if (path) await supabase.storage.from('avatars').remove([path]).catch(() => {})
}

async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let msg = error.message
    const resp = (error as unknown as { context?: Response }).context
    if (resp && typeof resp.json === 'function') {
      try { const b = await resp.json(); if (b?.message || b?.error) msg = b.message ?? b.error } catch { /* ignore */ }
    }
    throw new Error(msg)
  }
  return data as T
}

export function setStaffActive(userId: string, active: boolean) {
  return invokeFn<{ ok: boolean }>('set-staff-active', { user_id: userId, active })
}

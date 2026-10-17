import { supabase } from '../../supabase'

// Super admin "Sign in as". The super admin's own tokens are parked in localStorage while
// working as someone else; "Return" ends the impersonation and restores them.
const KEY = 'ubf_impersonator'

export type ImpersonationTarget = {
  user_id: string; name: string; email: string | null; job_title: string | null
  is_admin: boolean; companies: string | null
}
export type ActiveImpersonation = {
  actor_id: string; actor_name: string | null; target_name: string | null
  target_email: string | null; expires_at: string
}

export async function searchTargets(q: string): Promise<ImpersonationTarget[]> {
  const { data, error } = await supabase.rpc('impersonation_targets', { p_q: q.trim() })
  if (error) throw error
  return (data ?? []) as ImpersonationTarget[]
}

export async function currentImpersonation(): Promise<ActiveImpersonation | null> {
  const { data, error } = await supabase.rpc('my_impersonation')
  if (error) return null
  return (data ?? null) as ActiveImpersonation | null
}

export function isImpersonatingLocally(): boolean {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}

async function errMessage(error: { message: string }): Promise<string> {
  const resp = (error as unknown as { context?: Response }).context
  if (resp && typeof resp.json === 'function') {
    try { const b = await resp.json(); if (b?.message || b?.error) return b.message ?? b.error } catch { /* ignore */ }
  }
  return error.message
}

export async function startImpersonation(userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  const { data, error } = await supabase.functions.invoke('staff-impersonate', { body: { user_id: userId } })
  if (error) throw new Error(await errMessage(error))
  const t = data as { access_token: string; refresh_token: string }
  localStorage.setItem(KEY, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }))
  // Swap sessions without revoking the super admin's own session.
  const { error: sErr } = await supabase.auth.setSession({ access_token: t.access_token, refresh_token: t.refresh_token })
  if (sErr) { localStorage.removeItem(KEY); throw sErr }
  window.location.assign('/')
}

export async function returnToSelf(): Promise<void> {
  let saved: { access_token: string; refresh_token: string } | null = null
  try { saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { saved = null }
  await supabase.rpc('end_my_impersonation').then(() => {}, () => {})
  await supabase.auth.signOut({ scope: 'local' })
  localStorage.removeItem(KEY)
  if (saved) await supabase.auth.setSession(saved).catch(() => {})
  window.location.assign('/')
}

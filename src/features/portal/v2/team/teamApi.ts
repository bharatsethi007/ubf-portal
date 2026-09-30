import { supabase } from '../../../../supabase'

export type Role = 'admin' | 'member'
export type Member = {
  user_id: string; email: string; name: string | null; phone?: string | null; role: Role; status: 'active' | 'pending' | 'revoked'
  last_login_at: string | null; activated_at: string | null; created_at: string | null; is_me: boolean
  invited_by: string | null; invite_expires_at: string | null
}
export type Team = { my_role: Role | null; members: Member[] }

export async function fetchTeam(): Promise<Team> {
  const { data, error } = await supabase.rpc('portal_team_list')
  if (error) throw new Error('Team could not load. Refresh to try again.')
  return (data ?? { my_role: null, members: [] }) as Team
}

type Payload = { ok?: boolean; error?: string; emailed?: boolean }
type InvokeError = Error & { context?: Response }

async function call(body: Record<string, unknown>): Promise<Payload> {
  const { data, error } = await supabase.functions.invoke('portal-team', { body })
  let p = data as Payload | null
  if (!p && (error as InvokeError | null)?.context) {
    try { p = (await (error as InvokeError).context!.json()) as Payload } catch { p = null }
  }
  if (error || p?.error) throw new Error(p?.error || 'Something went wrong. Try again.')
  return p ?? { ok: true }
}

export const invite = (email: string, name: string, role: Role) => call({ action: 'invite', email, name, role })
export const resend = (userId: string) => call({ action: 'resend', user_id: userId })
export const setRole = (userId: string, role: Role) => call({ action: 'set_role', user_id: userId, role })
export const remove = (userId: string) => call({ action: 'remove', user_id: userId })
export const restore = (userId: string) => call({ action: 'restore', user_id: userId })

/** Name and phone for one person. Their own, or anyone's if you're an admin. */
export async function updatePerson(userId: string, name: string, phone: string): Promise<void> {
  const { error } = await supabase.rpc('portal_team_update_person', { p_user: userId, p_name: name, p_phone: phone })
  if (error) {
    if (/portal_team_update_person/.test(error.message)) throw new Error('Saving details isn\u2019t switched on yet. Ask UB Freight.')
    throw new Error(error.message.replace(/^.*?:\s*/, '') || 'Could not save')
  }
}

export function lastSeen(m: Member): string {
  if (m.status === 'pending') return m.invite_expires_at && m.invite_expires_at < new Date().toISOString() ? 'Invite expired' : 'Invite sent'
  if (m.status === 'revoked') return 'Removed'
  if (!m.last_login_at) return 'Never signed in'
  const d = Math.round((Date.now() - Date.parse(m.last_login_at)) / 864e5)
  return d < 1 ? 'Active today' : d === 1 ? 'Active yesterday' : d < 30 ? `Active ${d} days ago` : `Last seen ${new Date(m.last_login_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function initials(m: Member): string {
  const src = (m.name || m.email.split('@')[0]).replace(/[._-]+/g, ' ').trim()
  const p = src.split(/\s+/).filter(Boolean)
  return (p.length > 1 ? p[0][0] + p[1][0] : src.slice(0, 2)).toUpperCase()
}

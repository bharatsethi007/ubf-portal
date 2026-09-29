import { supabase } from '../../../../supabase'

export type Kind = 'shipment_created' | 'departed' | 'eta_changed' | 'arrived' | 'released' | 'invoice_issued'

export type Note = {
  id: number; kind: Kind; title: string; body: string | null; created_at: string
  job_unique: number | null; invoice_no: string | null; facts: Record<string, unknown>
}

export const KINDS: { kind: Kind; label: string; help: string; tone: 'blue' | 'amber' | 'green' | 'navy' }[] = [
  { kind: 'shipment_created', label: 'New shipment', help: 'We open a new shipment for you.', tone: 'blue' },
  { kind: 'departed', label: 'Departed', help: 'The vessel or flight has left origin.', tone: 'blue' },
  { kind: 'eta_changed', label: 'ETA change', help: 'The estimated arrival date moves.', tone: 'amber' },
  { kind: 'arrived', label: 'Arrived', help: 'Your shipment reaches its destination.', tone: 'green' },
  { kind: 'released', label: 'Released at port', help: 'Customs and MPI release a container (NZ imports).', tone: 'green' },
  { kind: 'invoice_issued', label: 'Invoice issued', help: 'We send you a new invoice.', tone: 'navy' },
]
export const kindMeta = (k: string) => KINDS.find((x) => x.kind === k) ?? { kind: k as Kind, label: 'Update', help: '', tone: 'blue' as const }

export type Prefs = { email_enabled: boolean; off_kinds: string[]; seen_at: string | null }
// Email is opt-in: off until the user turns it on.
const DEFAULT: Prefs = { email_enabled: false, off_kinds: [], seen_at: null }

export async function fetchNotes(limit = 30): Promise<Note[]> {
  const { data } = await supabase.from('portal_notifications')
    .select('id, kind, title, body, created_at, job_unique, invoice_no, facts')
    .order('created_at', { ascending: false }).limit(limit)
  return (data ?? []) as Note[]
}

export async function fetchPrefs(): Promise<Prefs> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return DEFAULT
  const { data } = await supabase.from('portal_notify_prefs').select('email_enabled, off_kinds, seen_at').eq('user_id', u.user.id).maybeSingle()
  return (data as Prefs | null) ?? DEFAULT
}

export async function savePrefs(email: boolean, off: string[]): Promise<void> {
  const { error } = await supabase.rpc('portal_notify_set_prefs', { p_email: email, p_off_kinds: off })
  if (error) throw new Error('Could not save. Try again.')
}

export async function markSeen(): Promise<void> {
  await supabase.rpc('portal_notify_mark_seen')
}

export function noteLink(n: Note): string {
  if (n.kind === 'invoice_issued' && n.invoice_no) return `/portal/billing?tab=all&inv=${encodeURIComponent(n.invoice_no)}`
  if (n.job_unique != null) return `/portal/shipments/${encodeURIComponent(`#${n.job_unique}`)}`
  return '/portal'
}

export function ago(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

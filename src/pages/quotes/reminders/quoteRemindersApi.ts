import { supabase } from '../../../supabase'

export type ReminderCandidate = {
  id: string
  quote_no: string | null
  customer_name: string | null
  from_port_code: string | null
  to_port_code: string | null
  owner_id: string | null
  owner_name: string | null
  email: string | null
  expires_at: string
  priced_at: string
  last_reminded_at: string | null
  reminders: number
  options: number
}

export type SendResult = { quote_id: string; quote_no?: string | null; ok: boolean; to?: string; error?: string }

export async function fetchReminderCandidates(mine: boolean): Promise<ReminderCandidate[]> {
  const { data, error } = await supabase.rpc('quote_reminder_candidates', { p_mine: mine })
  if (error) throw error
  return (data as ReminderCandidate[]) ?? []
}

export async function sendQuoteReminders(items: { quote_id: string; email: string | null }[]): Promise<{ sent: number; from: string; results: SendResult[] }> {
  const { data, error } = await supabase.functions.invoke('quote-reminder-send', { body: { items } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const detail = ctx ? await ctx.json().catch(() => null) : null
    throw new Error(detail?.error ?? error.message)
  }
  return data as { sent: number; from: string; results: SendResult[] }
}

export const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)

/** Blocking problems stop the send. */
export function emailBlock(email: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase()
  if (!e) return 'No email'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Invalid email'
  if (e.endsWith('@ubfreight.com')) return 'UBF address'
  return null
}

/** Warnings: allowed, but not ticked by default. */
export function emailWarn(email: string | null | undefined): string | null {
  const local = (email ?? '').trim().toLowerCase().split('@')[0] ?? ''
  if (/^(accounts?|ap|accountspayable|accounts?payable|invoices?|billing|payables?)\b/.test(local) || local.includes('accountspayable')) {
    return 'Accounts inbox. Check contact.'
  }
  return null
}

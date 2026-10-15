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
  thread_id: string | null
  thread_subject: string | null
  thread_mailbox: string | null
  thread_at: string | null
}

export type QuoteThread = {
  conversation_id: string
  subject: string | null
  mailbox: string
  contact_email: string | null
  last_message_at: string | null
  linked: boolean
}

/** Where a reminder goes: a thread id, or 'new' for a fresh email. */
export type SendAs = { id: string; label: string; mailbox: string | null } | { id: 'new'; label: 'New email'; mailbox: null }
export const NEW_EMAIL: SendAs = { id: 'new', label: 'New email', mailbox: null }

export type SendResult = {
  quote_id: string; quote_no?: string | null; ok: boolean; to?: string; error?: string
  mode?: 'thread' | 'new'; mailbox?: string; test?: boolean
}

export async function fetchReminderCandidates(mine: boolean): Promise<ReminderCandidate[]> {
  const { data, error } = await supabase.rpc('quote_reminder_candidates', { p_mine: mine })
  if (error) throw error
  return (data as ReminderCandidate[]) ?? []
}

export async function fetchQuoteThreads(quoteId: string, email: string | null): Promise<QuoteThread[]> {
  const { data, error } = await supabase.rpc('quote_reminder_threads', { p_quote: quoteId, p_email: email || null })
  if (error) throw error
  return (data as QuoteThread[]) ?? []
}

export async function sendQuoteReminders(items: {
  quote_id: string; email: string | null; conversation_id: string; pdf_base64?: string | null; pdf_name?: string | null
}[]): Promise<{ sent: number; from: string; results: SendResult[] }> {
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
  return null
}

/** UBF address = test send. Goes to that address only; links never change the quote. */
export const isTestEmail = (email: string | null | undefined) => (email ?? '').trim().toLowerCase().endsWith('@ubfreight.com')

export const mailboxShort = (m: string | null) => (m ?? '').split('@')[0].replace(/\.nz$/, '')

/** Warnings: allowed, but not ticked by default. */
export function emailWarn(email: string | null | undefined): string | null {
  if (isTestEmail(email)) return 'Test. Only this address gets it. Links do not change the quote.'
  const local = (email ?? '').trim().toLowerCase().split('@')[0] ?? ''
  if (/^(accounts?|ap|accountspayable|accounts?payable|invoices?|billing|payables?)\b/.test(local) || local.includes('accountspayable')) {
    return 'Accounts inbox. Check contact.'
  }
  return null
}

import { supabase } from '@/supabase'

export type EmailPurpose = 'delivery' | 'empty' | 'customer' | 'general'
export type EmailContact = { email: string; name: string | null; company: string | null; kind: string }
export type SendEmailPayload = {
  booking_id: string; to: string[]; cc: string[]; subject: string; html: string
  document_ids: string[]; purpose: EmailPurpose
}
export type SendEmailResult = { ok: boolean; from: string; to: string[]; cc: string[]; attachments: string[] }

const FALLBACK_MAILBOX: Record<string, string> = { IS: 'importsea.nz@ubfreight.com' }
const MODE_MODULE: Record<string, string> = { sea_import: 'IS', air_import: 'IA', sea_export: 'ES', air_export: 'EA' }

/** bookings.mode is derived from module by trigger, so it maps back 1:1. */
export const moduleOfMode = (mode: string | null | undefined) => MODE_MODULE[mode ?? ''] ?? null

export async function fetchModuleMailbox(module: string | null | undefined): Promise<string | null> {
  const m = (module ?? '').trim()
  if (!m) return null
  const { data } = await supabase.from('module_mailboxes').select('mailbox').eq('module', m).maybeSingle()
  return (data?.mailbox as string | undefined) ?? FALLBACK_MAILBOX[m] ?? null
}

/** Address book: most used first. kind filter ranks truckers first for cartage mails. */
export async function searchEmailContacts(q: string, kind?: string): Promise<EmailContact[]> {
  let query = supabase.from('email_contacts').select('email, name, company, kind')
    .order('last_used_at', { ascending: false, nullsFirst: false }).limit(8)
  const t = q.trim().replace(/[%,()]/g, '')
  if (t) query = query.or(`email.ilike.%${t}%,name.ilike.%${t}%,company.ilike.%${t}%`)
  const { data, error } = await query
  if (error) return []
  const rows = (data ?? []) as EmailContact[]
  return kind ? [...rows.filter((r) => r.kind === kind), ...rows.filter((r) => r.kind !== kind)] : rows
}

export async function fetchStaffSignature(): Promise<{ name: string; title: string | null; phone: string | null }> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return { name: 'UB Freight', title: null, phone: null }
  const { data } = await supabase.from('staff_users')
    .select('full_name, first_name, job_title, phone, email').eq('user_id', uid).maybeSingle()
  const name = (data?.full_name || data?.first_name || String(data?.email ?? '').split('@')[0] || 'UB Freight') as string
  return { name, title: (data?.job_title as string | null) ?? null, phone: (data?.phone as string | null) ?? null }
}

export async function sendBookingEmail(p: SendEmailPayload): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke('booking-email-send', { body: p })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    throw new Error(msg || error.message)
  }
  return data as SendEmailResult
}

import { supabase } from '@/supabase'

export type MilestoneState = 'done' | 'late' | 'todo'
export type Milestone = {
  key: string; label: string; owner: 'ubf' | 'customer' | 'carrier' | 'port'
  done: boolean; state: MilestoneState; at: string | null; due: string | null; note: string | null
}
export type BookingProgress = {
  booking_id: string; module: string; load_type: string | null; ref: string | null
  stage: string | null; next_action: string | null; action_due: string | null; urgency: string | null
  eta: string | null; lfd: string | null; depot: string | null; containers: number
  delivery_date: string | null; delivery_mode: string | null; hold: string | null
  milestones: Milestone[]; done: number; total: number
}
export type CustomerContacts = {
  account_id: string | null; customer_name: string | null
  emails: { email: string; name: string | null; source: string }[]
  whatsapp: { id: string; name: string; number: string }[]
  portal_users: number; thread_id: string | null; reply_to: string | null
}
export type SendResult = { channel: string; ok: boolean; detail?: string }
export type SendPayload = {
  booking_id: string; subject: string; title: string; body: string; category: string
  email?: { to: string[]; cc?: string[] }; whatsapp?: { contact_ids: string[] }; portal?: boolean
}

export async function fetchBookingProgress(bookingId: string): Promise<BookingProgress | null> {
  const { data, error } = await supabase.rpc('booking_progress', { p_booking: bookingId })
  if (error) throw error
  return (data as BookingProgress | null) ?? null
}

export async function fetchCustomerContacts(bookingId: string): Promise<CustomerContacts | null> {
  const { data, error } = await supabase.rpc('booking_customer_contacts', { p_booking: bookingId })
  if (error) throw error
  return (data as CustomerContacts | null) ?? null
}

export async function sendCustomerUpdate(p: SendPayload): Promise<{ ok: boolean; results: SendResult[] }> {
  const { data, error } = await supabase.functions.invoke('booking-customer-notify', { body: p })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    throw new Error(msg || error.message)
  }
  return data as { ok: boolean; results: SendResult[] }
}

/** "3 Oct" from ISO date/timestamp. */
export function dmy(v: string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v.length <= 10 ? `${v}T12:00:00` : v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

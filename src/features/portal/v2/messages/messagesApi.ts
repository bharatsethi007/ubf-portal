import { supabase } from '../../../../supabase'

export type Thread = {
  id: string; subject: string; status: 'open' | 'closed'; job_unique: number | null; booking_id: string | null
  last_message_at: string; last_sender: 'customer' | 'staff' | null; last_preview: string | null; unread: number
  shipment_no: string | null; booking_ref: string | null
}
export type Message = { id: number; kind: 'customer' | 'staff'; name: string | null; body: string; at: string; mine: boolean }
export type ThreadDetail = { id: string; subject: string; status: string; job_unique: number | null; messages: Message[] }

const clean = (m: string) => m.replace(/^.*?:\s*/, '') || 'Something went wrong. Try again.'

export async function listThreads(): Promise<Thread[]> {
  const { data, error } = await supabase.rpc('portal_threads_list')
  if (error) throw new Error('Messages could not load. Refresh to try again.')
  return (data ?? []) as Thread[]
}

export async function getThread(id: string): Promise<ThreadDetail | null> {
  const { data, error } = await supabase.rpc('portal_thread_get', { p_thread: id })
  if (error) throw new Error('Conversation could not load.')
  return (data ?? null) as ThreadDetail | null
}

/** Sends to a thread, or starts one (reusing the open thread for that shipment). Returns the thread id. */
export async function sendMessage(p: { thread?: string | null; body: string; subject?: string; job?: number | null }): Promise<string> {
  const { data, error } = await supabase.rpc('portal_message_send', {
    p_thread: p.thread ?? null, p_body: p.body, p_subject: p.subject ?? null, p_job_unique: p.job ?? null, p_booking: null,
  })
  if (error) throw new Error(clean(error.message))
  return data as string
}

export async function unreadTotal(): Promise<number> {
  try { return (await listThreads()).reduce((n, t) => n + Number(t.unread || 0), 0) } catch { return 0 }
}

export type ShipmentOption = { job_unique: number; label: string }
export async function recentShipments(): Promise<ShipmentOption[]> {
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)
  const { data } = await supabase.from('portal_shipments')
    .select('job_unique, module, job_no, shipment_no, house_bill, origin, destination, customer_ref')
    .gte('doc_date', since).order('doc_date', { ascending: false }).limit(200)
  return ((data ?? []) as Record<string, any>[]).map((s) => {
    const mod = String(s.module ?? '')
    const no = mod.startsWith('FI') && s.shipment_no != null ? `${mod}-${s.shipment_no}${Number(s.job_no) > 1 ? `/${s.job_no}` : ''}` : String(s.job_no ?? s.house_bill ?? s.job_unique)
    return { job_unique: s.job_unique, label: `${no} · ${s.origin ?? ''} → ${s.destination ?? ''}${s.customer_ref ? ` · ${s.customer_ref}` : ''}` }
  })
}

export function when(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
}

import { supabase } from '@/supabase'
import { docUrl, listEvents, saveStamped, type BookingMeta, type CreditorInvoice } from './creditorInvoicesApi'
import { stampInvoice } from './stampPdf'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00`); d.setDate(d.getDate() + n); return iso(d)
}

// Pay 2-3 days before ETA so release isn't held. Never in the past.
export function payBySuggestions(eta: string | null, due: string | null): { label: string; value: string }[] {
  const today = iso(new Date())
  const clamp = (v: string) => (v < today ? today : v)
  const out: { label: string; value: string }[] = []
  if (eta) {
    out.push({ label: 'ETA - 3', value: clamp(addDays(eta, -3)) })
    out.push({ label: 'ETA - 2', value: clamp(addDays(eta, -2)) })
  }
  if (due) out.push({ label: 'Due date', value: clamp(due) })
  if (out.length === 0) out.push({ label: 'In 7 days', value: addDays(today, 7) })
  return out
}

async function freshInvoice(id: string): Promise<CreditorInvoice> {
  const { data, error } = await supabase.from('creditor_invoices').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as CreditorInvoice
}

// Always stamps from the ORIGINAL file, so re-stamps never double up.
export async function stampAndSave(invoiceId: string, meta: BookingMeta): Promise<CreditorInvoice> {
  const inv = await freshInvoice(invoiceId)
  if (inv.status !== 'approved') throw new Error('Approve before stamping')
  if (!inv.document_id) throw new Error('Original document missing')
  const { url, mime } = await docUrl(inv.document_id)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load invoice file (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const events = await listEvents(inv.id)
  const out = await stampInvoice(bytes, mime, inv, meta, events)
  await saveStamped(inv, meta, out)
  return freshInvoice(invoiceId)
}

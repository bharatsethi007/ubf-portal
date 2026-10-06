// Export Air booking from an inbox conversation: prefill (free, or AI ~2c) then commit (booking + optional pickup).
import { supabase } from '../../supabase'

export type EaParty = { name?: string | null; address?: string | null; city?: string | null; postcode?: string | null; country?: string | null
  contact?: string | null; phone?: string | null; email?: string | null }
export type EaLine = { pieces?: number | null; l?: number | null; w?: number | null; h?: number | null; kg?: number | null }
export type EaForm = {
  shipper: EaParty; consignee: EaParty; destination: string | null; incoterm: string | null; goods: string | null
  po_refs: string | null; ready_date: string | null; is_dg: boolean; un_number: string | null; notes: string | null
  lines: EaLine[]; pickup: { needed: boolean | null; address: string | null; contact: string | null; phone: string | null; ready_time: string | null }
  _low_confidence?: string[]
}
export type BillTo = { account_id: string; name: string } | null
export type EaCreated = { id: string; booking_ref: string; documents: number; pickup_no: string | null; pickup_error?: string }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ea-booking', { body })
  if (error) {
    let msg = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try { const j = await ctx.json(); msg = j?.error ?? msg } catch { /* keep default */ }
    }
    throw new Error(msg)
  }
  const r = (data ?? {}) as T & { error?: string }
  if (r.error) throw new Error(r.error)
  return r
}

export const prefillEa = (conversationId: string, ai: boolean) =>
  call<{ form: EaForm; bill_to: BillTo }>({ action: 'prefill', conversation_id: conversationId, ai })
export const commitEa = (conversationId: string, form: EaForm, billTo: string | null, attachmentIds: number[]) =>
  call<EaCreated>({ action: 'commit', conversation_id: conversationId, form, bill_to_account: billTo, attachment_ids: attachmentIds })

export function totals(lines: EaLine[]) {
  const pcs = lines.reduce((s, l) => s + (Number(l.pieces) || 0), 0)
  const kg = lines.reduce((s, l) => s + (Number(l.kg) || 0), 0)
  const cbm = lines.reduce((s, l) => s + (l.l && l.w && l.h ? (l.l * l.w * l.h / 1e6) * (Number(l.pieces) || 1) : 0), 0)
  return { pcs, kg, cbm, chargeable: Math.round(Math.max(kg, cbm * 167) * 10) / 10 }
}

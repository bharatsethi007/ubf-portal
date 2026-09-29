import { supabase } from '../../../../supabase'

export type OfferStatus = 'pending' | 'expired' | 'approved' | 'rejected' | 'withdrawn'

/** A priced quote UBF sent to this account. Sell side only. */
export type QuoteOffer = {
  id: string
  response_no: string | null
  quote_id: string
  quote_no: string
  shipment_mode: string | null
  shipment_type: string | null
  from_port_code: string | null
  to_port_code: string | null
  customer_po: string | null
  incoterms: string | null
  goods: string | null
  containers: string | null
  carrier: string | null
  via_port: string | null
  transit_time_days: number | null
  etd: string | null
  eta: string | null
  valid_from: string | null
  valid_till: string | null
  origin_free_time_days: number | null
  detention_free_time_dest: number | null
  currency: string | null
  sub_total: number | null
  total_tax: number | null
  total_sell: number | null
  customer_notes: string | null
  terms_conditions: string | null
  portal_status: OfferStatus
  sent_at: string
  decided_at: string | null
  decision_note: string | null
  decided_by_name: string | null
}

export type OfferLine = {
  id: string
  response_id: string
  ord: number
  charge_group: string
  description: string | null
  unit: string | null
  qty: number | null
  sell_currency: string | null
  sell_rate: number | null
  min_sell: number | null
  total_sell: number | null
  tax: string | null
}

export const STATUS_LABEL: Record<OfferStatus, string> = {
  pending: 'Awaiting you',
  expired: 'Expired',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Closed',
}

export const STATUS_TONE: Record<OfferStatus, 'amber' | 'green' | 'red' | 'grey'> = {
  pending: 'amber',
  expired: 'grey',
  approved: 'green',
  rejected: 'red',
  withdrawn: 'grey',
}

export const GROUP_LABEL: Record<string, string> = {
  origin: 'Origin charges',
  freight: 'Freight',
  destination: 'Destination charges',
}
const GROUP_ORDER = ['origin', 'freight', 'destination']

export async function listOffers(): Promise<QuoteOffer[]> {
  const { data, error } = await supabase.from('portal_quote_offers').select('*').order('sent_at', { ascending: false })
  if (error) throw new Error('Could not load your quotes')
  return (data ?? []) as QuoteOffer[]
}

export async function listOfferLines(responseId: string): Promise<OfferLine[]> {
  const { data, error } = await supabase.from('portal_quote_offer_lines').select('*').eq('response_id', responseId).order('ord')
  if (error) throw new Error('Could not load the charges')
  return (data ?? []) as OfferLine[]
}

/** Lines grouped Origin, Freight, Destination, then anything else. */
export function groupLines(lines: OfferLine[]): { key: string; label: string; lines: OfferLine[]; total: number }[] {
  const keys = [...GROUP_ORDER, ...new Set(lines.map((l) => l.charge_group).filter((g) => !GROUP_ORDER.includes(g)))]
  return keys
    .map((key) => {
      const ls = lines.filter((l) => l.charge_group === key)
      return { key, label: GROUP_LABEL[key] ?? 'Other charges', lines: ls, total: ls.reduce((s, l) => s + (Number(l.total_sell) || 0), 0) }
    })
    .filter((g) => g.lines.length > 0)
}

export async function respondToOffer(id: string, decision: 'approve' | 'reject', note: string): Promise<string> {
  const { data, error } = await supabase.rpc('portal_quote_respond', { p_response: id, p_decision: decision, p_note: note || null })
  if (error) throw new Error(error.message || 'Could not save your answer')
  return String(data)
}

/** Whole days left on the quote, or null when there is no expiry. */
export function daysLeft(validTill: string | null): number | null {
  if (!validTill) return null
  const end = new Date(`${validTill}T23:59:59`)
  return Math.ceil((end.getTime() - Date.now()) / 86400000)
}

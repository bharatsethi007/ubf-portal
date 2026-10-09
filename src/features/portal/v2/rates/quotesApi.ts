import { supabase } from '../../../../supabase'

export type OfferStatus = 'pending' | 'expired' | 'approved' | 'rejected' | 'withdrawn' | 'crosswin'

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
  transit_time?: string | null
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
  booking_id: string | null
  booking_ref: string | null
  direction: 'import' | 'export' | null
  weight_kg: number | null
  cbm: number | null
  pieces: number | null
  cargo_ready_date: string | null
  is_hazardous: boolean | null
  need_refrigeration: boolean | null
  container_type: string | null
  container_count: number | null
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
  crosswin: 'Not chosen',
}

export const STATUS_TONE: Record<OfferStatus, 'amber' | 'green' | 'red' | 'grey'> = {
  pending: 'amber',
  expired: 'grey',
  approved: 'green',
  rejected: 'red',
  withdrawn: 'grey',
  crosswin: 'grey',
}

export const GROUP_LABEL: Record<string, string> = {
  origin: 'Origin charges',
  freight: 'Freight',
  destination: 'Destination charges',
}
const GROUP_ORDER = ['freight', 'origin', 'destination']

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

/** One quote with every option UBF sent for it. */
export type QuoteGroup = {
  quote_id: string
  quote_no: string
  first: QuoteOffer
  options: QuoteOffer[]
  status: OfferStatus
  sent_at: string
  cheapest: number | null
  currency: string
}

/** Quote-level status: approved wins, then waiting, then expired, then rejected, else closed. */
function groupStatus(options: QuoteOffer[]): OfferStatus {
  const has = (s: OfferStatus) => options.some((o) => o.portal_status === s)
  if (has('approved')) return 'approved'
  if (has('pending')) return 'pending'
  if (has('expired')) return 'expired'
  if (has('rejected')) return 'rejected'
  return 'withdrawn'
}

export function groupOffers(rows: QuoteOffer[]): QuoteGroup[] {
  const by = new Map<string, QuoteOffer[]>()
  for (const r of rows) by.set(r.quote_id, [...(by.get(r.quote_id) ?? []), r])
  return [...by.values()]
    .map((opts) => {
      const options = [...opts].sort((a, b) => (Number(a.total_sell) || 0) - (Number(b.total_sell) || 0))
      const live = options.filter((o) => o.portal_status === 'pending' || o.portal_status === 'approved')
      const priced = (live.length ? live : options).map((o) => Number(o.total_sell)).filter((n) => n > 0)
      return {
        quote_id: options[0].quote_id, quote_no: options[0].quote_no, first: options[0], options,
        status: groupStatus(options), sent_at: options.reduce((m, o) => (o.sent_at > m ? o.sent_at : m), options[0].sent_at),
        cheapest: priced.length ? Math.min(...priced) : null, currency: options[0].currency ?? 'NZD',
      }
    })
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
}

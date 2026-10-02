import { supabase } from '../../../supabase'

export type QuoteFacts = {
  incoterms: string | null; movement_type: string | null; service_type: string | null
  agent_id: string | null; freight_terms: string | null
  pickup_address: string | null; pickup_postal_code: string | null; pickup_location: string | null
  drop_address: string | null; drop_postal_code: string | null; drop_location: string | null
  shipper: string | null; consignee: string | null
  need_insurance: boolean; cargo_value: number | null
  is_hazardous: boolean; dg_un_number: string | null; dg_class: string | null
  need_refrigeration: boolean; reefer_temp_c: number | null
}

const COLS = 'incoterms, movement_type, service_type, agent_id, freight_terms, pickup_address, pickup_postal_code, pickup_location, '
  + 'drop_address, drop_postal_code, drop_location, shipper, consignee, need_insurance, cargo_value, is_hazardous, dg_un_number, dg_class, '
  + 'need_refrigeration, reefer_temp_c'

export async function fetchQuoteFacts(quoteId: string): Promise<QuoteFacts | null> {
  const { data, error } = await supabase.from('quotes').select(COLS).eq('id', quoteId).maybeSingle()
  if (error) throw error
  return (data as unknown as QuoteFacts) ?? null
}

export type RateRow = { k: string; buy: number | null; sell: number | null; min: number | null }
export type RateCardSummary = {
  cardId: string | null; carrier: string; validTo: string | null; daysLeft: number | null
  currency: string | null; transitDays: number | null; via: string | null; rows: RateRow[]
}
export type RateSummary = {
  kind: string; live: RateCardSummary[]; expired: RateCardSummary[]; drafts: number
  localOrigin: { title: string; validTo: string | null }[]; localDest: { title: string; validTo: string | null }[]
}

const n = (v: unknown) => (v == null || v === '' ? null : Number(v))
function card(x: Record<string, any>): RateCardSummary {
  return {
    cardId: x.card_id ?? null, carrier: String(x.carrier_name ?? x.carrier ?? 'Unknown'), validTo: x.valid_to ?? null,
    daysLeft: n(x.days_left), currency: x.currency ?? null, transitDays: n(x.transit_days), via: x.via ?? null,
    rows: ((x.rows as Record<string, any>[]) ?? []).map((r) => ({ k: String(r.k), buy: n(r.buy), sell: n(r.sell), min: n(r.min) })),
  }
}

export async function fetchRateSummary(from: string, to: string, kind: 'fcl' | 'lcl' | 'air'): Promise<RateSummary | null> {
  const { data, error } = await supabase.rpc('lane_rate_summary', { p_origin: from, p_dest: to, p_kind: kind })
  if (error) throw error
  const r = data as Record<string, any> | null
  if (!r) return null
  const sheets = (v: unknown) => ((v as Record<string, any>[]) ?? []).map((s) => ({ title: String(s.title), validTo: s.valid_to ?? null }))
  return {
    kind: String(r.kind), live: ((r.live as Record<string, any>[]) ?? []).map(card),
    expired: ((r.expired as Record<string, any>[]) ?? []).map(card), drafts: Number(r.drafts) || 0,
    localOrigin: sheets(r.local_origin), localDest: sheets(r.local_dest),
  }
}

export type Sailings = { lastEtd: string | null; gapDays: number | null; departures90: number; upcoming: { voyage: string; etd: string; jobs: number }[] }
export async function fetchSailings(from: string, to: string, mode: string): Promise<Sailings | null> {
  const { data, error } = await supabase.rpc('lane_sailings', { p_origin: from, p_dest: to, p_mode: mode })
  if (error) throw error
  const r = data as Record<string, any> | null
  if (!r) return null
  return {
    lastEtd: r.last_etd ?? null, gapDays: n(r.gap_days), departures90: Number(r.departures_90d) || 0,
    upcoming: ((r.upcoming as Record<string, any>[]) ?? []).map((u) => ({ voyage: String(u.voyage), etd: String(u.etd), jobs: Number(u.jobs) || 0 })),
  }
}

export type Credit = { outstanding: number; overdue: number; overdue60: number; oldestDays: number | null; invoicesOverdue: number; creditLimit: number | null; terms: string | null }
export async function fetchCredit(accountId: string): Promise<Credit | null> {
  const { data, error } = await supabase.rpc('customer_credit_snapshot', { p_account: accountId })
  if (error) throw error
  const r = data as Record<string, any> | null
  if (!r) return null
  return {
    outstanding: Number(r.outstanding) || 0, overdue: Number(r.overdue) || 0, overdue60: Number(r.overdue_60) || 0,
    oldestDays: n(r.oldest_days), invoicesOverdue: Number(r.invoices_overdue) || 0, creditLimit: n(r.credit_limit), terms: r.terms ?? null,
  }
}

import { supabase } from '../../../supabase'
import {
  computeResponseTotals, fetchQuoteResponseLines, newQuoteResponseLine, saveQuoteResponseLines,
  updateResponseTotals, type QuoteResponseLine,
} from '../quoteResponseLinesApi'
import { createQuoteResponse } from '../quoteResponsesApi'

export type IntelCharge = {
  code: string; description: string; erpDescription: string | null; group: string | null
  pct: number; jobsWith: number; medSell: number; p25Sell: number; p75Sell: number
  medCost: number; gpPct: number | null
}
export type IntelSimilar = {
  jobNo: string | null; date: string | null; customer: string | null; weightKg: number | null
  volumeM3: number | null; sell: number; gpPct: number | null; sameCustomer: boolean
}
export type LaneIntel = {
  jobs: number; months: number; loadType: string | null; direction: string | null
  totals: { medSell: number; p25Sell: number; p75Sell: number; gpPct: number | null; gpP25: number | null; gpP75: number | null } | null
  charges: IntelCharge[]
  customer: { jobs: number; lastDate: string | null; medSell: number | null; gpPct: number | null; codes: string[] } | null
  similar: IntelSimilar[]
}
export type IntelQuery = {
  from: string; to: string; mode: 'air' | 'sea'; direction: string | null; loadType: string | null
  customerId: string | null; weightKg: number | null; volumeM3: number | null; months: number
}

const num = (v: unknown): number => Number(v) || 0
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))

export async function fetchLaneIntel(q: IntelQuery): Promise<LaneIntel | null> {
  const { data, error } = await supabase.rpc('lane_intel', {
    p_origin: q.from, p_dest: q.to, p_mode: q.mode, p_direction: q.direction || null,
    p_load_type: q.loadType || null, p_customer: q.customerId || null,
    p_weight_kg: q.weightKg || null, p_volume_m3: q.volumeM3 || null, p_months: q.months,
  })
  if (error) throw error
  const r = data as Record<string, any> | null
  if (!r) return null
  const t = r.totals as Record<string, any> | null
  const c = r.customer as Record<string, any> | null
  return {
    jobs: num(r.jobs), months: num(r.months), loadType: r.load_type ?? null, direction: r.direction ?? null,
    totals: t && t.med_sell != null ? {
      medSell: num(t.med_sell), p25Sell: num(t.p25_sell), p75Sell: num(t.p75_sell),
      gpPct: numOrNull(t.gp_pct), gpP25: numOrNull(t.gp_p25), gpP75: numOrNull(t.gp_p75),
    } : null,
    charges: ((r.charges as Record<string, any>[]) ?? []).map((x) => ({
      code: String(x.code), description: String(x.description ?? x.code), erpDescription: x.erp_description ?? null,
      group: x.group ?? null, pct: num(x.pct), jobsWith: num(x.jobs_with), medSell: num(x.med_sell),
      p25Sell: num(x.p25_sell), p75Sell: num(x.p75_sell), medCost: num(x.med_cost), gpPct: numOrNull(x.gp_pct),
    })),
    customer: c && num(c.jobs) > 0 ? {
      jobs: num(c.jobs), lastDate: c.last_date ?? null, medSell: numOrNull(c.med_sell), gpPct: numOrNull(c.gp_pct),
      codes: ((c.codes as string[]) ?? []).map(String),
    } : null,
    similar: ((r.similar as Record<string, any>[]) ?? []).map((x) => ({
      jobNo: x.job_no ?? null, date: x.date ?? null, customer: x.customer ?? null,
      weightKg: numOrNull(x.weight_kg), volumeM3: numOrNull(x.volume_m3), sell: num(x.sell),
      gpPct: numOrNull(x.gp_pct), sameCustomer: Boolean(x.same_customer),
    })),
  }
}

// The option the panel checks against: newest one that is not declined.
export type IntelOption = {
  id: string; responseNo: string | null; currency: string; lines: QuoteResponseLine[]
  totalSell: number | null; marginPct: number | null; validTill: string | null; carrier: string | null
}

export async function fetchCurrentOption(quoteId: string): Promise<IntelOption | null> {
  const { data, error } = await supabase
    .from('quote_responses')
    .select('id, response_no, status, currency, total_sell, margin_pct, valid_till, carrier, created_at')
    .eq('quote_id', quoteId)
    .neq('status', 'declined')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const r = (data ?? [])[0] as Record<string, any> | undefined
  if (!r) return null
  const lines = await fetchQuoteResponseLines(String(r.id))
  return {
    id: String(r.id), responseNo: r.response_no ?? null, currency: r.currency || 'NZD', lines,
    totalSell: numOrNull(r.total_sell), marginPct: numOrNull(r.margin_pct),
    validTill: r.valid_till ? String(r.valid_till).slice(0, 10) : null, carrier: r.carrier ?? null,
  }
}

const FREIGHT_CODES = new Set(['FES', 'FIS', 'AFR', 'OFR', 'FAFES', 'FEA', 'FIA', 'AFE', 'AFI'])
export function groupFor(c: IntelCharge, direction: string | null): string {
  if (c.group) return c.group
  if (FREIGHT_CODES.has(c.code) || /freight/i.test(c.erpDescription ?? '')) return 'freight'
  return (direction ?? '').startsWith('imp') ? 'destination' : 'origin'
}

/** Appends ready-made lines to the current option (creates a draft option if none). */
export async function addLinesToQuote(quoteId: string, option: IntelOption | null, extra: QuoteResponseLine[]): Promise<string> {
  const responseId = option?.id ?? (await createQuoteResponse(quoteId)).id
  const existing = option ? await fetchQuoteResponseLines(responseId) : []
  const all = [...existing, ...extra.map((l, i) => ({ ...l, ord: existing.length + i }))]
  await saveQuoteResponseLines(responseId, all)
  await updateResponseTotals(responseId, computeResponseTotals(all))
  return responseId
}

/** Appends lane-median charges to the current option (creates a draft option if none). */
export async function addChargesToQuote(
  quoteId: string, option: IntelOption | null, charges: IntelCharge[], direction: string | null,
): Promise<string> {
  const responseId = option?.id ?? (await createQuoteResponse(quoteId)).id
  const existing = option ? await fetchQuoteResponseLines(responseId) : []
  const added = charges.map((c, i) => ({
    ...newQuoteResponseLine(existing.length + i, 'NZD'),
    description: c.description,
    charge_group: groupFor(c, direction),
    unit: 'per_shipment',
    qty: '1',
    buy_rate: c.medCost > 0 ? String(Math.round(c.medCost * 100) / 100) : '',
    sell_rate: String(Math.round(c.medSell * 100) / 100),
  }))
  const all = [...existing, ...added]
  await saveQuoteResponseLines(responseId, all)
  await updateResponseTotals(responseId, computeResponseTotals(all))
  return responseId
}

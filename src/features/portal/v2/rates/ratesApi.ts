import { supabase } from '../../../../supabase'

export type RateProduct = 'FCL' | 'LCL' | 'AIR'

export type RateExtra = { label: string; amount: number; currency: string; basis: string | null; scope: string | null }

/** Sell-side rate option. Buy rates never reach the browser. */
export type RateOption = {
  ref: string
  product: RateProduct
  carrier: string | null
  container_type: string | null
  currency: string
  unit: string
  sell: number | null
  sell_min: number | null
  breaks: Record<string, number> | null
  transit_days: number | null
  via: string | null
  frequency: string | null
  valid_to: string | null
  origin: string | null
  destination: string | null
  extras: RateExtra[]
}

export type RateQuery = {
  mode: 'sea' | 'air'
  load: 'FCL' | 'LCL'
  container: string
  origin: string
  destination: string
}

const clean = (m: string) => m.replace(/^.*?:\s*/, '')

export async function searchRates(q: RateQuery): Promise<RateOption[]> {
  const { data, error } = await supabase.rpc('portal_search_rates', {
    p_pol: q.origin, p_pod: q.destination, p_mode: q.mode,
    p_load: q.mode === 'sea' ? q.load : null, p_container: q.mode === 'sea' && q.load === 'FCL' ? q.container || null : null,
  })
  if (error) throw new Error(clean(error.message) || 'Rate search failed')
  return (data ?? []) as RateOption[]
}

export async function fetchRateOption(ref: string): Promise<RateOption | null> {
  const { data, error } = await supabase.rpc('portal_rate_option', { p_ref: ref })
  if (error) return null
  return (data ?? null) as RateOption | null
}

export type QuoteRequest = {
  mode: 'sea' | 'air'
  load_type: string
  direction: 'import' | 'export'
  origin: string
  destination: string
  container_type: string
  container_count: string
  cargo_ready_date: string
  goods_description: string
  weight_kg: string
  cbm: string
  is_dg: boolean
  is_temp_controlled: boolean
  customer_ref: string
  notes: string
}

export async function requestQuote(q: QuoteRequest): Promise<{ quote_id: string; quote_no: string }> {
  const { data, error } = await supabase.rpc('portal_request_quote', { p: q })
  if (error) throw new Error(clean(error.message) || 'Could not send the quote request')
  return (Array.isArray(data) ? data[0] : data) as { quote_id: string; quote_no: string }
}

const NZ_AIRPORTS = new Set(['AKL', 'CHC', 'WLG', 'ZQN', 'DUD', 'NSN', 'PMR', 'NPE', 'HLZ', 'IVC'])
const isNz = (code: string) => (code.length === 3 ? NZ_AIRPORTS.has(code.toUpperCase()) : code.toUpperCase().startsWith('NZ'))

/** Import when the lane lands in New Zealand, otherwise export. */
export function directionOf(origin: string, destination: string): 'import' | 'export' {
  if (destination && isNz(destination) && !(origin && isNz(origin))) return 'import'
  return 'export'
}

export const BREAKS: { k: string; label: string; from: number }[] = [
  { k: 'n', label: 'Under 45 kg', from: 0 },
  { k: '45', label: '45 kg+', from: 45 },
  { k: '100', label: '100 kg+', from: 100 },
  { k: '250', label: '250 kg+', from: 250 },
  { k: '500', label: '500 kg+', from: 500 },
  { k: '1000', label: '1,000 kg+', from: 1000 },
]

/** Air: chargeable = max(actual, volume x 167). Sea LCL: W/M = max(m³, tonnes). */
export function estimateTotal(o: RateOption, input: { kg: number; cbm: number; boxes: number }): number | null {
  if (o.sell == null) return null
  if (o.product === 'FCL') return o.sell * Math.max(1, input.boxes || 1)
  if (o.product === 'LCL') {
    const wm = Math.max(input.cbm || 0, (input.kg || 0) / 1000)
    if (!wm) return null
    return Math.max(o.sell * wm, o.sell_min ?? 0)
  }
  const chg = Math.max(input.kg || 0, (input.cbm || 0) * 167)
  if (!chg) return null
  const br = o.breaks ?? {}
  const rate = [...BREAKS].reverse().find((b) => chg >= b.from && br[b.k] != null)
  const perKg = rate ? br[rate.k] : o.sell
  return Math.max(perKg * chg, o.sell_min ?? 0)
}

export function money(n: number | null | undefined, cur: string): string {
  if (n == null) return '—'
  return `${cur} ${n.toLocaleString('en-NZ', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}

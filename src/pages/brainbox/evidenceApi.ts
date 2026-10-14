import { supabase } from '../../supabase'

export type Verdict = 'add' | 'update' | 'agrees' | 'weak' | 'unmapped' | 'extra' | 'skip'
export type TreatAs = 'standard' | 'contingent' | 'freight' | 'passthrough' | 'ignore'

export type PayerException = { account_id: string; name: string; jobs: number; price: number; share: number }

export type Evidence = {
  erp_code: string
  charge_code: string | null
  label: string
  treat_as: TreatAs
  confirmed: boolean
  descs: string[]
  jobs: number
  payers: number
  model: 'flat' | 'min_kg' | 'varies'
  price: number | null
  min_sell: number | null
  fit: number
  billed: number
  last_seen: string
  sheet_id: string | null
  sheet_title: string | null
  line_id: string | null
  card_label: string | null
  card_basis: string | null
  card_sell: number | null
  card_min: number | null
  verdict: Verdict
  exceptions: PayerException[]
}

export type Lane = { module: string; origin: string; dest: string; label: string }

// Start with the lane that is half the business. More lanes once this one is proven.
export const LANES: Lane[] = [{ module: 'FEA', origin: 'AKL', dest: 'NAN', label: 'Export air · Auckland to Nadi' }]

const n = (v: unknown) => (v == null ? null : Number(v))

export async function fetchLaneEvidence(lane: Lane, months: number, product: 'consol' | 'direct'): Promise<Evidence[]> {
  const { data, error } = await supabase.rpc('brainbox_lane_evidence', {
    p_module: lane.module, p_origin: lane.origin, p_dest: lane.dest, p_months: months, p_product: product,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as Evidence),
    jobs: Number(r.jobs), payers: Number(r.payers), fit: Number(r.fit ?? 0), billed: Number(r.billed ?? 0),
    price: n(r.price), min_sell: n(r.min_sell), card_sell: n(r.card_sell), card_min: n(r.card_min),
    descs: (r.descs as string[] | null) ?? [], exceptions: (r.exceptions as PayerException[] | null) ?? [],
  }))
}

export async function mapErpCode(erpCode: string, chargeCode: string | null, treatAs: TreatAs): Promise<void> {
  const { error } = await supabase.rpc('brainbox_map_erp_code', { p_erp_code: erpCode, p_charge_code: chargeCode ?? '', p_treat_as: treatAs })
  if (error) throw new Error(error.message)
}

/** Writes the evidence price onto the matching card line (or adds one). Approvers only; audited. */
export async function applyToCard(e: Evidence, lane: Lane): Promise<void> {
  if (!e.sheet_id || e.price == null) throw new Error('No charge sheet for this lane')
  const basis = e.model === 'min_kg' ? 'per_kg' : e.card_basis && e.card_basis !== 'per_kg' ? e.card_basis : 'per_shipment'
  const { error } = await supabase.rpc('brainbox_apply_card_line', {
    p_sheet: e.sheet_id, p_line: e.line_id, p_label: e.card_label ?? e.label, p_charge_code: e.charge_code,
    p_basis: basis, p_sell: e.price, p_min: e.model === 'min_kg' ? e.min_sell : null,
    p_evidence: { lane, erp_code: e.erp_code, jobs: e.jobs, payers: e.payers, fit: e.fit, model: e.model },
  })
  if (error) throw new Error(error.message)
}

export async function suggestPayerRule(e: Evidence, p: PayerException, lane: Lane): Promise<void> {
  const { error } = await supabase.rpc('brainbox_suggest_payer_rule', {
    p_account: p.account_id, p_charge_code: e.charge_code, p_amount: p.price,
    p_lane: { module: lane.module, origin: lane.origin, dest: lane.dest },
    p_evidence: { erp_code: e.erp_code, jobs: p.jobs, share: p.share, lane_price: e.price },
  })
  if (error) throw new Error(error.message)
}

export function describeEvidence(e: Evidence, money: (x: number) => string): string {
  const fit = `${Math.round(e.fit * 100)}%`
  if (e.model === 'flat' && e.price != null) return `NZD ${money(e.price)} on ${fit} of ${e.jobs.toLocaleString()} jobs`
  if (e.model === 'min_kg' && e.price != null)
    return `Min NZD ${money(e.min_sell ?? 0)}, then NZD ${e.price}/kg. Fits ${fit} of ${e.jobs.toLocaleString()} jobs`
  return `No single price. ${e.jobs.toLocaleString()} jobs`
}

export function describeCard(e: Evidence, money: (x: number) => string): string {
  if (!e.line_id || e.card_sell == null) return 'Not on card'
  if (e.card_basis === 'per_kg') return `Min NZD ${money(e.card_min ?? 0)}, then NZD ${e.card_sell}/kg`
  return `NZD ${money(e.card_sell)} ${(e.card_basis ?? '').replace('_', ' ')}`
}

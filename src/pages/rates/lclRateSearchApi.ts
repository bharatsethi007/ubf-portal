import { supabase } from '../../supabase'

export type LclQuoteLane = {
  from_port_code: string | null
  to_port_code: string | null
  currency: string | null
  wm: number   // chargeable W/M (revenue tonnes)
  cbm: number  // total volume, for per_cbm surcharges; falls back to wm when unknown
}

export type LclLaneCharge = { code: string; label: string; perWm: number; sellPerWm: number }
export type LclRateSurcharge = { label: string; amount: number; sellAmount: number; basis: string; scope: string | null }

export type LclRateOption = {
  cardId: string
  coLoaderCode: string
  coLoaderName: string
  currency: string
  transitDays: number | null
  via: string | null
  frequency: string | null
  validFrom: string | null
  validTo: string | null
  status: string
  wm: number
  cbm: number
  ratePerWm: number
  sellPerWm: number
  minCharge: number
  sellMin: number
  laneCharges: LclLaneCharge[]
  surcharges: LclRateSurcharge[]
  freightTotal: number
  surchargeTotal: number
  total: number
  freightSellTotal: number
  surchargeSellTotal: number
  sellTotal: number
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

function withinValidity(from: string | null, to: string | null, today: string): boolean {
  if (from && from > today) return false
  if (to && to < today) return false
  return true
}

// Freight-family sell fallback: explicit sell wins, else apply the card's default
// markup %, else fall back to cost. (rate_surcharges stay pass-through — sell = cost.)
function sellWithMarkup(cost: number, explicit: number | null, markupPct: number | null): number {
  if (explicit != null && explicit > 0) return explicit
  if (markupPct != null && markupPct > 0) return cost * (1 + markupPct / 100)
  return cost
}

export function wmFromCargo(rows: { total_cbm: number | null; gross_wt: number | null }[]): { wm: number; cbm: number } {
  let cbm = 0
  let tonnes = 0
  for (const r of rows) {
    cbm += Number(r.total_cbm) || 0
    tonnes += (Number(r.gross_wt) || 0) / 1000
  }
  return { wm: round2(Math.max(cbm, tonnes)), cbm: round2(cbm) }
}

export async function fetchLclQuoteLane(quoteId: string): Promise<LclQuoteLane> {
  const { data: q, error } = await supabase
    .from('quotes').select('from_port_code, to_port_code, cargo_value_currency').eq('id', quoteId).single()
  if (error) throw error
  const { data: cargo } = await supabase.from('quote_cargo_lines').select('total_cbm, gross_wt').eq('quote_id', quoteId)
  const r = q as Record<string, any>
  const { wm, cbm } = wmFromCargo(((cargo as any[]) ?? []).map((c) => ({ total_cbm: c.total_cbm, gross_wt: c.gross_wt })))
  return {
    from_port_code: r.from_port_code ?? null,
    to_port_code: r.to_port_code ?? null,
    currency: r.cargo_value_currency ?? null,
    wm,
    cbm,
  }
}

export async function searchLclRates(lane: LclQuoteLane): Promise<LclRateOption[]> {
  if (!lane.from_port_code || !lane.to_port_code || lane.wm <= 0) return []
  const today = new Date().toISOString().slice(0, 10)
  const wm = lane.wm
  const cbm = lane.cbm > 0 ? lane.cbm : lane.wm

  const { data: lines, error } = await supabase
    .from('rate_card_lcl_lines')
    .select('rate_per_wm, sell_per_wm, min_charge, sell_min, currency_code, transit_days, via, frequency, valid_from, valid_to, lane_charges, rate_card_id, rate_cards!inner(id, title, co_loader_code, status, valid_from, valid_to, currency_code, default_markup_pct, co_loaders(name))')
    .eq('origin_port_code', lane.from_port_code)
    .eq('dest_port_code', lane.to_port_code)
  if (error) throw error

  type Grp = { card: Record<string, any>; line: Record<string, any> }
  const groups = new Map<string, Grp>()
  for (const raw of ((lines as Record<string, any>[]) ?? [])) {
    const card = Array.isArray(raw.rate_cards) ? raw.rate_cards[0] : raw.rate_cards
    if (!card) continue
    const status = String(card.status)
    if (status !== 'active' && status !== 'validated') continue
    const vf = raw.valid_from ?? card.valid_from ?? null
    const vt = raw.valid_to ?? card.valid_to ?? null
    if (!withinValidity(vf, vt, today)) continue
    const id = String(card.id)
    const existing = groups.get(id)
    // one line per card+lane expected; if duplicated, keep the cheapest
    if (!existing || (Number(raw.rate_per_wm) || 0) < (Number(existing.line.rate_per_wm) || 0)) {
      groups.set(id, { card, line: raw })
    }
  }
  if (groups.size === 0) return []

  const cardIds = [...groups.keys()]
  const { data: surs } = await supabase
    .from('rate_surcharges').select('rate_card_id, label, amount, sell_amount, basis, scope').in('rate_card_id', cardIds)
  const surByCard = new Map<string, Record<string, any>[]>()
  for (const s of ((surs as Record<string, any>[]) ?? [])) {
    const id = String(s.rate_card_id)
    if (!surByCard.has(id)) surByCard.set(id, [])
    surByCard.get(id)!.push(s)
  }

  const options: LclRateOption[] = []
  for (const [id, g] of groups) {
    const card = g.card
    const line = g.line
    const cl = Array.isArray(card.co_loaders) ? card.co_loaders[0] : card.co_loaders
    const markup = card.default_markup_pct != null ? Number(card.default_markup_pct) : null
    const currency = line.currency_code ? String(line.currency_code) : (card.currency_code ? String(card.currency_code) : '')

    const ratePerWm = Number(line.rate_per_wm) || 0
    const minCharge = Number(line.min_charge) || 0
    const sellPerWm = round2(sellWithMarkup(ratePerWm, line.sell_per_wm != null ? Number(line.sell_per_wm) : null, markup))
    const sellMin = round2(sellWithMarkup(minCharge, line.sell_min != null ? Number(line.sell_min) : null, markup))

    const freightTotal = round2(Math.max(ratePerWm * wm, minCharge))
    const freightSellTotal = round2(Math.max(sellPerWm * wm, sellMin))

    // lane_charges: freight-family per-W/M surcharges (BAF/LSS/…) — markup fallback for sell
    const laneCharges: LclLaneCharge[] = (Array.isArray(line.lane_charges) ? line.lane_charges : []).map((c: any) => {
      const perWm = Number(c.per_wm) || 0
      return { code: String(c.code ?? ''), label: String(c.label ?? c.code ?? ''), perWm, sellPerWm: round2(sellWithMarkup(perWm, null, markup)) }
    })

    // rate_surcharges: pass-through family — sell = explicit, else cost
    const surcharges: LclRateSurcharge[] = (surByCard.get(id) ?? []).map((s) => ({
      label: String(s.label),
      amount: Number(s.amount) || 0,
      sellAmount: (Number(s.sell_amount) || 0) > 0 ? Number(s.sell_amount) : (Number(s.amount) || 0),
      basis: String(s.basis),
      scope: s.scope ?? null,
    }))

    let surchargeTotal = 0
    let surchargeSellTotal = 0
    for (const c of laneCharges) { surchargeTotal += c.perWm * wm; surchargeSellTotal += c.sellPerWm * wm }
    for (const s of surcharges) {
      if (s.basis === 'per_container' || s.basis === 'per_teu') continue // n/a to LCL
      if (s.basis === 'per_cbm') { surchargeTotal += s.amount * cbm; surchargeSellTotal += s.sellAmount * cbm }
      else if (s.basis === 'percent') { surchargeTotal += (s.amount / 100) * freightTotal; surchargeSellTotal += (s.sellAmount / 100) * freightSellTotal }
      else { surchargeTotal += s.amount; surchargeSellTotal += s.sellAmount } // per_bl / flat
    }
    surchargeTotal = round2(surchargeTotal)
    surchargeSellTotal = round2(surchargeSellTotal)

    options.push({
      cardId: id,
      coLoaderCode: String(card.co_loader_code ?? ''),
      coLoaderName: cl?.name ? String(cl.name) : String(card.co_loader_code ?? ''),
      currency,
      transitDays: line.transit_days != null ? Number(line.transit_days) : null,
      via: line.via ?? null,
      frequency: line.frequency ?? null,
      validFrom: line.valid_from ?? card.valid_from ?? null,
      validTo: line.valid_to ?? card.valid_to ?? null,
      status: String(card.status),
      wm,
      cbm,
      ratePerWm,
      sellPerWm,
      minCharge,
      sellMin,
      laneCharges,
      surcharges,
      freightTotal,
      surchargeTotal,
      total: round2(freightTotal + surchargeTotal),
      freightSellTotal,
      surchargeSellTotal,
      sellTotal: round2(freightSellTotal + surchargeSellTotal),
    })
  }
  options.sort((a, b) => a.total - b.total)
  return options
}

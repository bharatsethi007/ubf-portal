import { supabase } from '../../supabase'
import { applyMargin, cardMargin, lineMargin, resolveMargin, type Margin } from './margin'

export type LclQuoteLane = {
  from_port_code: string | null
  to_port_code: string | null
  currency: string | null
  wm: number   // chargeable W/M (revenue tonnes)
  cbm: number  // total volume, for per_cbm surcharges; falls back to wm when unknown
}

export type LclLaneCharge = { code: string; label: string; perWm: number; sellPerWm: number; min: number | null }
export type LclRateSurcharge = {
  label: string; amount: number; sellAmount: number; basis: string; scope: string | null
  currency: string          // own currency (e.g. NZD destination charges on a USD card)
  minAmount: number | null  // floor on the computed amount
  contingent: boolean       // only if it applies; never totalled
  condition: string | null
}

// Computed buy/sell for one surcharge on this shipment (null = basis n/a to LCL).
export function lclSurchargeAmounts(s: LclRateSurcharge, wm: number, cbm: number, freightBuy: number, freightSell: number): { buy: number; sell: number; qty: number; unit: string } | null {
  let buy: number, sell: number, qty = 1, unit = 'Flat'
  if (s.basis === 'per_container' || s.basis === 'per_teu') return null
  if (s.basis === 'per_wm') { qty = wm; unit = 'Per W/M'; buy = s.amount * wm; sell = s.sellAmount * wm }
  else if (s.basis === 'per_cbm') { qty = cbm; unit = 'Per CBM'; buy = s.amount * cbm; sell = s.sellAmount * cbm }
  else if (s.basis === 'percent') { unit = '% of freight'; buy = (s.amount / 100) * freightBuy; sell = (s.sellAmount / 100) * freightSell }
  else { unit = s.basis === 'per_bl' ? 'Per B/L' : 'Flat'; buy = s.amount; sell = s.sellAmount }
  if (s.minAmount != null) { buy = Math.max(buy, s.minAmount); sell = Math.max(sell, s.minAmount) }
  return { buy: round2(buy), sell: round2(sell), qty, unit }
}

export type LclRateOption = {
  cardId: string
  coLoaderCode: string
  coLoaderName: string
  coLoaderLogo: string | null
  originAgent: string | null   // co-loader agent to nominate with at origin
  terms: string | null
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
  surcharges: LclRateSurcharge[]        // billable (contingent excluded)
  possibleCharges: LclRateSurcharge[]   // contingent: shown, not totalled
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

// Freight-family sell fallback: explicit sell wins, else the line margin, else the card's
// default margin (% or fixed per W/M), else cost. (rate_surcharges stay pass-through — sell = cost.)
function sellWithMargin(cost: number, explicit: number | null, margin: Margin | null): number {
  if (explicit != null && explicit > 0) return explicit
  return applyMargin(cost, margin)
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
    .select('origin_agent, rate_per_wm, sell_per_wm, min_charge, sell_min, margin_type, margin_value, currency_code, transit_days, via, frequency, valid_from, valid_to, lane_charges, rate_card_id, rate_cards!inner(id, title, co_loader_code, status, valid_from, valid_to, currency_code, default_markup_pct, default_margin_type, default_margin_fixed, terms, co_loaders(name, logo_url))')
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
    .from('rate_surcharges').select('rate_card_id, label, amount, sell_amount, basis, scope, currency_code, min_amount, contingent, condition, origin_countries, except_origin_countries, valid_from, valid_to').in('rate_card_id', cardIds)
  // Country-scoped surcharges (e.g. ex-Australia vs ex-worldwide PSC): UN/LOCODE prefix = country.
  const polCountry = lane.from_port_code.slice(0, 2).toUpperCase()
  const countryOk = (s: Record<string, any>) => {
    const only = Array.isArray(s.origin_countries) ? (s.origin_countries as string[]) : null
    const except = Array.isArray(s.except_origin_countries) ? (s.except_origin_countries as string[]) : null
    if (only && only.length > 0 && !only.includes(polCountry)) return false
    if (except && except.includes(polCountry)) return false
    return true
  }
  const surByCard = new Map<string, Record<string, any>[]>()
  for (const s of ((surs as Record<string, any>[]) ?? [])) {
    if (!countryOk(s)) continue
    if (!withinValidity(s.valid_from ?? null, s.valid_to ?? null, today)) continue // seasonal, e.g. BMSB
    const id = String(s.rate_card_id)
    if (!surByCard.has(id)) surByCard.set(id, [])
    surByCard.get(id)!.push(s)
  }

  const options: LclRateOption[] = []
  for (const [id, g] of groups) {
    const card = g.card
    const line = g.line
    const cl = Array.isArray(card.co_loaders) ? card.co_loaders[0] : card.co_loaders
    const margin = resolveMargin(lineMargin(line.margin_type, line.margin_value), cardMargin(card))
    // Lane charges (BAF/LSS per W/M) only take a % margin; a fixed margin goes on the base rate once.
    const laneMargin = margin?.type === 'pct' ? margin : null
    const currency = line.currency_code ? String(line.currency_code) : (card.currency_code ? String(card.currency_code) : '')

    const ratePerWm = Number(line.rate_per_wm) || 0
    const minCharge = Number(line.min_charge) || 0
    const sellPerWm = round2(sellWithMargin(ratePerWm, line.sell_per_wm != null ? Number(line.sell_per_wm) : null, margin))
    const sellMin = round2(sellWithMargin(minCharge, line.sell_min != null ? Number(line.sell_min) : null, margin))

    const freightTotal = round2(Math.max(ratePerWm * wm, minCharge))
    const freightSellTotal = round2(Math.max(sellPerWm * wm, sellMin))

    // lane_charges: freight-family per-W/M surcharges (BAF/LSS/…) — markup fallback for sell
    const laneCharges: LclLaneCharge[] = (Array.isArray(line.lane_charges) ? line.lane_charges : []).map((c: any) => {
      const perWm = Number(c.per_wm) || 0
      return { code: String(c.code ?? ''), label: String(c.label ?? c.code ?? ''), perWm, sellPerWm: round2(sellWithMargin(perWm, null, laneMargin)), min: c.min != null ? Number(c.min) : null }
    })

    // rate_surcharges: pass-through family — sell = explicit, else cost
    const allSurs: LclRateSurcharge[] = (surByCard.get(id) ?? []).map((s) => ({
      label: String(s.label),
      amount: Number(s.amount) || 0,
      sellAmount: (Number(s.sell_amount) || 0) > 0 ? Number(s.sell_amount) : (Number(s.amount) || 0),
      basis: String(s.basis),
      scope: s.scope ?? null,
      currency: s.currency_code ? String(s.currency_code) : currency,
      minAmount: s.min_amount != null ? Number(s.min_amount) : null,
      contingent: !!s.contingent,
      condition: s.condition ? String(s.condition) : null,
    }))
    const surcharges = allSurs.filter((s) => !s.contingent)
    const possibleCharges = allSurs.filter((s) => s.contingent)

    // Totals stay in the card currency; other-currency lines are FX'd in the card UI.
    let surchargeTotal = 0
    let surchargeSellTotal = 0
    for (const c of laneCharges) {
      surchargeTotal += Math.max(c.perWm * wm, c.min ?? 0); surchargeSellTotal += Math.max(c.sellPerWm * wm, c.min ?? 0)
    }
    for (const s of surcharges) {
      if (s.currency !== currency) continue
      const a = lclSurchargeAmounts(s, wm, cbm, freightTotal, freightSellTotal)
      if (a) { surchargeTotal += a.buy; surchargeSellTotal += a.sell }
    }
    surchargeTotal = round2(surchargeTotal)
    surchargeSellTotal = round2(surchargeSellTotal)

    options.push({
      cardId: id,
      coLoaderCode: String(card.co_loader_code ?? ''),
      coLoaderName: cl?.name ? String(cl.name) : String(card.co_loader_code ?? ''),
      coLoaderLogo: cl?.logo_url ? String(cl.logo_url) : null,
      originAgent: line.origin_agent ? String(line.origin_agent) : null,
      terms: card.terms ? String(card.terms) : null,
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
      possibleCharges,
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

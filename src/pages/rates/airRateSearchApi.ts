import { supabase } from '../../supabase'
import { attachAirLocalCharges, type OptionAirLocalCharge } from './airLocalChargeMatch'

// IATA volumetric standard: 1 m³ = 6000 cm³ → 167 kg. (Courier/express uses 5000 → 200; not air cargo.)
export const AIR_VOLUMETRIC_KG_PER_CBM = 167

export type AirQuoteLane = {
  from_port_code: string | null
  to_port_code: string | null
  currency: string | null
  chargeableKg: number  // max(gross kg, volumetric kg)
  grossKg: number
  cbm: number
  movement?: string | null   // 'import' | 'export' — scopes local-charge sheets
  incoterm?: string | null   // drives leg defaults + completeness in the card
  hasPickup?: boolean        // pickup address set → origin cartage in play
  hasDelivery?: boolean      // drop address set → destination cartage in play
}

export type AirRateSurcharge = { label: string; amount: number; sellAmount: number; basis: string; scope: string | null }

export type AirRateOption = {
  cardId: string
  airlineCode: string
  airlineName: string
  currency: string
  transitDays: number | null
  via: string | null
  frequency: string | null
  validFrom: string | null
  validTo: string | null
  status: string
  chargeableKg: number
  grossKg: number
  cbm: number
  billedKg: number          // weight the rate is applied to (may pivot up to a break minimum)
  appliedRatePerKg: number  // buy per-kg rate actually used
  sellRatePerKg: number
  minCharge: number
  minApplied: boolean
  surcharges: AirRateSurcharge[]
  freightTotal: number
  surchargeTotal: number
  total: number
  freightSellTotal: number
  surchargeSellTotal: number
  sellTotal: number
  localCharges: OptionAirLocalCharge[]
  freightless?: boolean   // synthetic charges-only option (no freight rate on the lane)
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

function withinValidity(from: string | null, to: string | null, today: string): boolean {
  if (from && from > today) return false
  if (to && to < today) return false
  return true
}

type Band = { thresh: number; rate: number }

// Lowest correct air freight for a chargeable weight, honouring weight-break pivoting.
function priceAirFreight(w: number, bands: Band[], minCharge: number): { billedKg: number; appliedRate: number; freight: number; minApplied: boolean } {
  if (bands.length === 0) return { billedKg: w, appliedRate: 0, freight: round2(minCharge), minApplied: minCharge > 0 }
  const sorted = [...bands].sort((a, b) => a.thresh - b.thresh)
  // Normal band = highest threshold ≤ w; if w is below every threshold, use the lowest band.
  let normal = sorted[0]
  for (const b of sorted) if (b.thresh <= w) normal = b
  let best = { billedKg: w, appliedRate: normal.rate, freight: normal.rate * w }
  // Pivot: bill at a higher break's minimum weight if that lower rate × its min is cheaper.
  for (const b of sorted) {
    if (b.thresh > w) {
      const f = b.rate * b.thresh
      if (f < best.freight) best = { billedKg: b.thresh, appliedRate: b.rate, freight: f }
    }
  }
  const freight = Math.max(best.freight, minCharge)
  return { billedKg: best.billedKg, appliedRate: best.appliedRate, freight: round2(freight), minApplied: freight > best.freight }
}

export function chargeableKgFromCargo(rows: { total_cbm: number | null; gross_wt: number | null }[]): { chargeableKg: number; grossKg: number; cbm: number } {
  let cbm = 0
  let grossKg = 0
  for (const r of rows) {
    cbm += Number(r.total_cbm) || 0
    grossKg += Number(r.gross_wt) || 0
  }
  const volKg = cbm * AIR_VOLUMETRIC_KG_PER_CBM
  return { chargeableKg: Math.ceil(Math.max(grossKg, volKg) * 2) / 2, grossKg: round2(grossKg), cbm: round2(cbm) }
}

export async function fetchAirQuoteLane(quoteId: string): Promise<AirQuoteLane> {
  const { data: q, error } = await supabase
    .from('quotes').select('from_port_code, to_port_code, cargo_value_currency, movement_type, incoterms, pickup_address, drop_address').eq('id', quoteId).single()
  if (error) throw error
  const { data: cargo } = await supabase.from('quote_cargo_lines').select('total_cbm, gross_wt').eq('quote_id', quoteId)
  const r = q as Record<string, any>
  const { chargeableKg, grossKg, cbm } = chargeableKgFromCargo(((cargo as any[]) ?? []).map((c) => ({ total_cbm: c.total_cbm, gross_wt: c.gross_wt })))
  return { from_port_code: r.from_port_code ?? null, to_port_code: r.to_port_code ?? null, currency: r.cargo_value_currency ?? null, chargeableKg, grossKg, cbm,
    movement: r.movement_type ?? null, incoterm: r.incoterms ?? null, hasPickup: !!r.pickup_address, hasDelivery: !!r.drop_address }
}

// When no freight card matches the lane we still want to surface matching local
// charges so destination-only incoterms (e.g. DPU/DAP import, where freight is the
// seller's cost) can be quoted. This synthesises a freight-less option to hang them on.
function makeChargesOnlyOption(lane: AirQuoteLane): AirRateOption {
  return {
    cardId: 'charges-only',
    airlineCode: '',
    airlineName: 'Charges only \u2014 no freight rate',
    currency: lane.currency || '',
    transitDays: null, via: null, frequency: null,
    validFrom: null, validTo: null,
    status: 'charges-only',
    chargeableKg: lane.chargeableKg, grossKg: lane.grossKg, cbm: lane.cbm,
    billedKg: 0, appliedRatePerKg: 0, sellRatePerKg: 0,
    minCharge: 0, minApplied: false,
    surcharges: [],
    freightTotal: 0, surchargeTotal: 0, total: 0,
    freightSellTotal: 0, surchargeSellTotal: 0, sellTotal: 0,
    localCharges: [],
    freightless: true,
  }
}

export async function searchAirRates(lane: AirQuoteLane): Promise<AirRateOption[]> {
  if (!lane.from_port_code || !lane.to_port_code || lane.chargeableKg <= 0) return []
  const today = new Date().toISOString().slice(0, 10)
  const w = lane.chargeableKg
  const cbm = lane.cbm > 0 ? lane.cbm : 0

  const { data: lines, error } = await supabase
    .from('rate_card_air_lines')
    .select('min_charge, rate_n, rate_45, rate_100, rate_250, rate_500, rate_1000, markup_pct, currency_code, transit_days, via, frequency, rate_card_id, rate_cards!inner(id, title, vendor_account_id, vendor_name, status, valid_from, valid_to, currency_code, default_markup_pct)')
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
    if (!withinValidity(card.valid_from ?? null, card.valid_to ?? null, today)) continue
    const id = String(card.id)
    if (!groups.has(id)) groups.set(id, { card, line: raw })
  }
  if (groups.size === 0) {
    const chargesOnly = makeChargesOnlyOption(lane)
    await attachAirLocalCharges(lane, [chargesOnly])
    return chargesOnly.localCharges.length > 0 ? [chargesOnly] : []
  }

  const cardIds = [...groups.keys()]
  const { data: surs } = await supabase
    .from('rate_surcharges').select('rate_card_id, label, amount, sell_amount, basis, scope').in('rate_card_id', cardIds)
  const surByCard = new Map<string, Record<string, any>[]>()
  for (const s of ((surs as Record<string, any>[]) ?? [])) {
    const id = String(s.rate_card_id)
    if (!surByCard.has(id)) surByCard.set(id, [])
    surByCard.get(id)!.push(s)
  }

  const BREAKS: { thresh: number; col: string }[] = [
    { thresh: 0, col: 'rate_n' }, { thresh: 45, col: 'rate_45' }, { thresh: 100, col: 'rate_100' },
    { thresh: 250, col: 'rate_250' }, { thresh: 500, col: 'rate_500' }, { thresh: 1000, col: 'rate_1000' },
  ]

  const options: AirRateOption[] = []
  for (const [id, g] of groups) {
    const { card, line } = g
    const markup = card.default_markup_pct != null ? Number(card.default_markup_pct) : null
    const lineMarkup = line.markup_pct != null ? Number(line.markup_pct) : markup
    const currency = line.currency_code ? String(line.currency_code) : (card.currency_code ? String(card.currency_code) : '')
    const minCharge = Number(line.min_charge) || 0

    const buyBands: Band[] = BREAKS
      .filter((b) => line[b.col] != null && !isNaN(Number(line[b.col])))
      .map((b) => ({ thresh: b.thresh, rate: Number(line[b.col]) }))
    const buy = priceAirFreight(w, buyBands, minCharge)

    const mk = lineMarkup != null && lineMarkup > 0 ? lineMarkup / 100 : 0
    const sellBands: Band[] = buyBands.map((b) => ({ thresh: b.thresh, rate: round2(b.rate * (1 + mk)) }))
    const sellMin = round2(minCharge * (1 + mk))
    const sell = priceAirFreight(w, sellBands, sellMin)

    const surcharges: AirRateSurcharge[] = (surByCard.get(id) ?? []).map((s) => ({
      label: String(s.label),
      amount: Number(s.amount) || 0,
      sellAmount: (Number(s.sell_amount) || 0) > 0 ? Number(s.sell_amount) : (Number(s.amount) || 0),
      basis: String(s.basis),
      scope: s.scope ?? null,
    }))

    let surchargeTotal = 0
    let surchargeSellTotal = 0
    for (const s of surcharges) {
      if (s.basis === 'per_kg') { surchargeTotal += s.amount * w; surchargeSellTotal += s.sellAmount * w }
      else if (s.basis === 'per_cbm') { surchargeTotal += s.amount * cbm; surchargeSellTotal += s.sellAmount * cbm }
      else if (s.basis === 'percent') { surchargeTotal += (s.amount / 100) * buy.freight; surchargeSellTotal += (s.sellAmount / 100) * sell.freight }
      else { surchargeTotal += s.amount; surchargeSellTotal += s.sellAmount } // per_awb / per_bl / flat
    }
    surchargeTotal = round2(surchargeTotal)
    surchargeSellTotal = round2(surchargeSellTotal)

    options.push({
      cardId: id,
      airlineCode: String(card.vendor_account_id ?? ''),
      airlineName: card.vendor_name ? String(card.vendor_name) : String(card.vendor_account_id ?? ''),
      currency,
      transitDays: line.transit_days != null ? Number(line.transit_days) : null,
      via: line.via ?? null,
      frequency: line.frequency ?? null,
      validFrom: card.valid_from ?? null,
      validTo: card.valid_to ?? null,
      status: String(card.status),
      chargeableKg: w,
      grossKg: lane.grossKg,
      cbm: lane.cbm,
      billedKg: buy.billedKg,
      appliedRatePerKg: buy.appliedRate,
      sellRatePerKg: sell.appliedRate,
      minCharge,
      minApplied: buy.minApplied,
      surcharges,
      freightTotal: buy.freight,
      surchargeTotal,
      total: round2(buy.freight + surchargeTotal),
      freightSellTotal: sell.freight,
      surchargeSellTotal,
      sellTotal: round2(sell.freight + surchargeSellTotal),
      localCharges: [],
    })
  }
  options.sort((a, b) => a.total - b.total)
  await attachAirLocalCharges(lane, options)
  return options
}

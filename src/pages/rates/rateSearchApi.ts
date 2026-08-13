import { supabase } from '../../supabase'
import { attachLocalCharges, type OptionLocalCharge } from './localChargeMatch'

const SIZE_TO_CANONICAL: Record<string, string> = {
  '20': '20GP', '40': '40GP', '20HC': '20HC', '40HC': '40HQ', '40HQ': '40HQ', '20GP': '20GP', '40GP': '40GP',
}
export function normSize(size: string): string { return SIZE_TO_CANONICAL[size] ?? size }
function teuFor(code: string): number { return code.startsWith('40') ? 2 : 1 }

export type QuoteLane = {
  from_port_code: string | null
  to_port_code: string | null
  currency: string | null
  movement?: string | null
  containers: { size: string; qty: number }[]
}

export type RateOptionChip = { container_type: string; base_rate: number; sell_rate: number }
export type RateOptionSurcharge = { label: string; amount: number; sell_amount: number; basis: string; scope: string | null }
export type RateOption = {
  cardId: string
  carrierCode: string
  carrierName: string
  carrierLineName: string | null
  currency: string
  transitDays: number | null
  via: string | null
  validFrom: string | null
  validTo: string | null
  status: string
  chips: RateOptionChip[]
  surcharges: RateOptionSurcharge[]
  localCharges: OptionLocalCharge[]
  missingCodes: string[]
  freightTotal: number
  surchargeTotal: number
  total: number
  freightSellTotal: number
  surchargeSellTotal: number
  sellTotal: number
}

export async function fetchQuoteLane(quoteId: string): Promise<QuoteLane> {
  const { data: q, error } = await supabase
    .from('quotes').select('from_port_code, to_port_code, cargo_value_currency, movement_type').eq('id', quoteId).single()
  if (error) throw error
  const { data: cons } = await supabase.from('quote_containers').select('container_size, qty').eq('quote_id', quoteId)
  const r = q as Record<string, any>
  return {
    from_port_code: r.from_port_code ?? null,
    to_port_code: r.to_port_code ?? null,
    currency: r.cargo_value_currency ?? null,
    movement: r.movement_type ?? null,
    containers: ((cons as any[]) ?? []).map((c) => ({ size: String(c.container_size ?? ''), qty: Number(c.qty) || 1 })),
  }
}

function withinValidity(from: string | null, to: string | null, today: string): boolean {
  if (from && from > today) return false
  if (to && to < today) return false
  return true
}

export async function searchFclRates(lane: QuoteLane): Promise<RateOption[]> {
  if (!lane.from_port_code || !lane.to_port_code || lane.containers.length === 0) return []
  const qtyByCode = new Map<string, number>()
  for (const c of lane.containers) {
    const code = normSize(c.size)
    qtyByCode.set(code, (qtyByCode.get(code) ?? 0) + c.qty)
  }
  const wantedCodes = [...qtyByCode.keys()]
  const today = new Date().toISOString().slice(0, 10)
  const totalContainers = [...qtyByCode.values()].reduce((a, b) => a + b, 0)
  const totalTeu = [...qtyByCode.entries()].reduce((a, [code, q]) => a + teuFor(code) * q, 0)

  const { data: lines, error } = await supabase
    .from('rate_card_fcl_lines')
    .select('base_rate, sell_rate, container_type, transit_days, via, valid_from, valid_to, rate_card_id, rate_cards!inner(id, title, shipping_line_code, vendor_name, status, valid_from, valid_to, currency_code, shipping_lines(name))')
    .eq('origin_port_code', lane.from_port_code)
    .eq('dest_port_code', lane.to_port_code)
    .in('container_type', wantedCodes)
  if (error) throw error

  type Grp = { card: Record<string, any>; chips: Map<string, { rate: number; sell: number; transit: number | null; via: string | null; vf: string | null; vt: string | null }> }
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
    if (!groups.has(id)) groups.set(id, { card, chips: new Map() })
    groups.get(id)!.chips.set(String(raw.container_type), {
      rate: Number(raw.base_rate) || 0,
      sell: Number(raw.sell_rate) || 0,
      transit: raw.transit_days != null ? Number(raw.transit_days) : null,
      via: raw.via ?? null, vf, vt,
    })
  }
  if (groups.size === 0) return []

  const cardIds = [...groups.keys()]
  const { data: surs } = await supabase
    .from('rate_surcharges').select('rate_card_id, label, amount, sell_amount, basis, scope').in('rate_card_id', cardIds)
  const surByCard = new Map<string, RateOptionSurcharge[]>()
  for (const s of ((surs as Record<string, any>[]) ?? [])) {
    const id = String(s.rate_card_id)
    if (!surByCard.has(id)) surByCard.set(id, [])
    surByCard.get(id)!.push({ label: String(s.label), amount: Number(s.amount) || 0, sell_amount: Number(s.sell_amount) || 0, basis: String(s.basis), scope: s.scope ?? null })
  }

  const options: RateOption[] = []
  for (const [id, g] of groups) {
    const sl = Array.isArray(g.card.shipping_lines) ? g.card.shipping_lines[0] : g.card.shipping_lines
    const chips: RateOptionChip[] = []
    let freightTotal = 0
    let freightSellTotal = 0
    const missingCodes: string[] = []
    for (const code of wantedCodes) {
      const hit = g.chips.get(code)
      if (hit) {
        chips.push({ container_type: code, base_rate: hit.rate, sell_rate: hit.sell })
        const qty = qtyByCode.get(code) ?? 0
        freightTotal += hit.rate * qty
        freightSellTotal += (hit.sell > 0 ? hit.sell : hit.rate) * qty
      }
      else missingCodes.push(code)
    }
    const surcharges = surByCard.get(id) ?? []
    let surchargeTotal = 0
    let surchargeSellTotal = 0
    for (const s of surcharges) {
      const sellAmt = s.sell_amount > 0 ? s.sell_amount : s.amount
      if (s.basis === 'per_container') { surchargeTotal += s.amount * totalContainers; surchargeSellTotal += sellAmt * totalContainers }
      else if (s.basis === 'per_teu') { surchargeTotal += s.amount * totalTeu; surchargeSellTotal += sellAmt * totalTeu }
      else if (s.basis === 'percent') { surchargeTotal += (s.amount / 100) * freightTotal; surchargeSellTotal += (sellAmt / 100) * freightSellTotal }
      else if (s.basis === 'per_bl' || s.basis === 'flat') { surchargeTotal += s.amount; surchargeSellTotal += sellAmt }
      // per_cbm not applicable to FCL — skipped
    }
    const transits = [...g.chips.values()].map((c) => c.transit).filter((t): t is number => t != null)
    const vias = [...g.chips.values()].map((c) => c.via).filter(Boolean)
    const vfs = [...g.chips.values()].map((c) => c.vf).filter(Boolean).sort()
    const vts = [...g.chips.values()].map((c) => c.vt).filter(Boolean).sort()
    options.push({
      cardId: id,
      carrierCode: g.card.shipping_line_code ? String(g.card.shipping_line_code) : '',
      carrierName: String(g.card.vendor_name || (sl?.name ?? '') || g.card.shipping_line_code || '—'),
      carrierLineName: sl?.name ? String(sl.name) : (g.card.shipping_line_code ? String(g.card.shipping_line_code) : null),
      currency: g.card.currency_code ? String(g.card.currency_code) : '',
      transitDays: transits.length ? Math.min(...transits) : null,
      via: vias.length ? String(vias[0]) : null,
      validFrom: vfs[0] ?? null,
      validTo: vts.length ? vts[vts.length - 1] : null,
      status: String(g.card.status),
      chips, surcharges, localCharges: [], missingCodes,
      freightTotal: Math.round(freightTotal * 100) / 100,
      surchargeTotal: Math.round(surchargeTotal * 100) / 100,
      total: Math.round((freightTotal + surchargeTotal) * 100) / 100,
      freightSellTotal: Math.round(freightSellTotal * 100) / 100,
      surchargeSellTotal: Math.round(surchargeSellTotal * 100) / 100,
      sellTotal: Math.round((freightSellTotal + surchargeSellTotal) * 100) / 100,
    })
  }
  options.sort((a, b) => a.total - b.total)
  await attachLocalCharges(lane, options)
  return options
}

export function containerTotals(containers: { size: string; qty: number }[]) {
  const qtyByCode = new Map<string, number>()
  let totalContainers = 0
  let totalTeu = 0
  for (const c of containers) {
    const code = normSize(c.size)
    qtyByCode.set(code, (qtyByCode.get(code) ?? 0) + c.qty)
    totalContainers += c.qty
    totalTeu += teuFor(code) * c.qty
  }
  return { qtyByCode, totalContainers, totalTeu }
}

export async function fetchPortAliases(): Promise<{ alias: string; port_code: string }[]> {
  const { data } = await supabase.from('port_aliases').select('alias, port_code')
  return ((data as Record<string, any>[]) ?? []).map((r) => ({ alias: String(r.alias), port_code: String(r.port_code) }))
}

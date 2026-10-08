import { normSize, type RateOption } from '@/pages/rates/rateSearchApi'
import type { LclRateOption } from '@/pages/rates/lclRateSearchApi'
import { lclSurchargeAmounts } from '@/pages/rates/lclRateSearchApi'
import { chargeLegsFor, type ChargeLegs } from '@/pages/rates/incotermLegs'
import type { QuoteResponseLine } from '@/features/quoteBooking/quoteBookingApi'
import type { CostDraft } from './bookingCostsApi'
import { classifyCost, normGroup, type ChargeGroup, type CostType } from './costTypes'

export type PreviewLine = CostDraft & { key: string; include: boolean }

const r2 = (n: number) => Math.round(n * 100) / 100

function scopeGroup(scope: string | null | undefined): ChargeGroup {
  const s = (scope || '').toLowerCase()
  if (s.startsWith('orig')) return 'origin'
  if (s.startsWith('dest')) return 'destination'
  return 'freight'
}

// Import costs UBF pays: legs after the incoterm pivot. Unknown incoterm = include all.
export function legsForImport(incoterm: string | null): ChargeLegs {
  return chargeLegsFor(incoterm, 'import') ?? { origin: true, freight: true, dest: true }
}

function included(g: ChargeGroup, legs: ChargeLegs): boolean {
  return g === 'origin' ? legs.origin : g === 'freight' ? legs.freight : legs.dest
}

function line(key: string, d: Omit<CostDraft, 'source'>, legs: ChargeLegs): PreviewLine {
  const g = d.charge_group ?? 'freight'
  return { ...d, key, source: 'rate_card', include: included(g, legs) && d.amount > 0 }
}

export function fclOptionToLines(o: RateOption, containers: { size: string; qty: number }[], legs: ChargeLegs): PreviewLine[] {
  const vendor = o.carrierName || o.carrierLineName || o.carrierCode
  const base = { vendor_name: vendor, vendor_code: o.carrierCode || null, source_ref: { rate_card_id: o.cardId } }
  const out: PreviewLine[] = []
  o.chips.forEach((c) => {
    const qty = containers.filter((x) => normSize(x.size) === c.container_type)
      .reduce((n, x) => n + x.qty, 0) || 1
    out.push(line(`f-${c.container_type}`, { ...base, cost_type: 'shipping_line', charge_group: 'freight',
      description: `Ocean freight ${c.container_type}`, qty, unit: 'Per container', rate: c.base_rate,
      currency: o.currency || 'USD', amount: r2(c.base_rate * qty) }, legs))
  })
  o.surcharges.forEach((s, i) => {
    out.push(line(`s-${i}`, { ...base, cost_type: classifyCost(s.label, vendor, 'shipping_line'), charge_group: scopeGroup(s.scope),
      description: s.label, qty: 1, unit: s.basis, rate: s.amount, currency: o.currency || 'USD', amount: r2(s.lineAmount) }, legs))
  })
  o.localCharges.forEach((c, i) => {
    const g: ChargeGroup = c.group === 'origin' ? 'origin' : 'destination'
    const v = c.vendorName || vendor
    out.push(line(`l-${i}`, { ...base, vendor_name: v, cost_type: classifyCost(c.label, v, 'shipping_line'), charge_group: g,
      description: c.label, qty: 1, unit: c.basis, rate: null, currency: c.buyCurrency || 'NZD', amount: r2(c.buyAmount) }, legs))
  })
  return out
}

export function lclOptionToLines(o: LclRateOption, legs: ChargeLegs): PreviewLine[] {
  const vendor = o.coLoaderName || o.coLoaderCode
  const base = { vendor_name: vendor, vendor_code: o.coLoaderCode || null, source_ref: { rate_card_id: o.cardId } }
  const ccy = o.currency || 'USD'
  const out: PreviewLine[] = [line('f', { ...base, cost_type: 'co_loader', charge_group: 'freight',
    description: 'LCL ocean freight', qty: o.wm, unit: 'Per W/M', rate: o.ratePerWm, currency: ccy, amount: o.freightTotal }, legs)]
  o.laneCharges.forEach((c, i) => {
    out.push(line(`lc-${i}`, { ...base, cost_type: 'co_loader', charge_group: 'freight', description: c.label || c.code,
      qty: o.wm, unit: 'Per W/M', rate: c.perWm, currency: ccy, amount: r2(Math.max(c.perWm * o.wm, c.min ?? 0)) }, legs))
  })
  o.surcharges.forEach((s, i) => {
    const a = lclSurchargeAmounts(s, o.wm, o.cbm, o.freightTotal, o.freightSellTotal)
    if (!a) return
    out.push(line(`s-${i}`, { ...base, cost_type: classifyCost(s.label, vendor, 'co_loader'), charge_group: scopeGroup(s.scope),
      description: s.label, qty: a.qty, unit: a.unit, rate: s.amount, currency: s.currency || ccy, amount: a.buy }, legs))
  })
  o.localCharges.forEach((c, i) => {
    const v = c.vendorName || vendor
    out.push(line(`l-${i}`, { ...base, vendor_name: v, cost_type: classifyCost(c.label, v, 'co_loader'),
      charge_group: c.group === 'origin' ? 'origin' : 'destination', description: c.label, qty: c.qty, unit: c.basis,
      rate: null, currency: c.buyCurrency || 'NZD', amount: r2(c.buyAmount) }, legs))
  })
  return out
}

export function quoteLinesToDrafts(lines: QuoteResponseLine[], responseCcy: string | null, fallbackType: CostType): CostDraft[] {
  const out: CostDraft[] = []
  for (const l of lines) {
    const qty = Number(l.qty ?? 1) || 1
    const native = l.buy_rate != null ? Number(l.buy_rate) * qty : null
    const amount = native != null ? native : Number(l.total_buy ?? 0)
    if (!amount) continue
    const currency = native != null ? (l.buy_currency || responseCcy || 'NZD') : (responseCcy || 'NZD')
    const desc = l.description || 'Charge'
    out.push({
      cost_type: classifyCost(desc, l.vendor, fallbackType), vendor_name: l.vendor, vendor_code: null,
      charge_group: normGroup(l.charge_group), description: desc, qty, unit: l.unit, rate: l.buy_rate,
      currency, amount: r2(amount), source: 'quote', source_ref: { quote_line_id: l.id },
    })
  }
  return out
}

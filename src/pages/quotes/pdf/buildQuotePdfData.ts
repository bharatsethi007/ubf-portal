import { computeResponseLine, computeResponseTotals, type QuoteResponseLine } from '../quoteResponseLinesApi'
import type { QuoteRecord } from '../quotesApi'
import type { QuoteResponseRecord } from '../quoteResponsesApi'
import type { QuoteCargoLine } from '../quoteCargoApi'
import type { QuoteContainer } from '../quoteContainersApi'

export type PdfCharge =
  | { grp: string }
  | { desc: string; qty: string; unit: string; min: string; price: string; ex: string; tax: string; frcr: string; amt: string }

export type QuotePdfData = {
  quoteNo: string
  mode: 'air' | 'sea'
  company: { email: string; phone: string }
  from: { code: string; name: string; cc: string | null }
  to: { code: string; name: string; cc: string | null }
  portLabel: string
  requestedBy: { company: string; contact: string; address: string; phone: string; email: string }
  origin: { port: string }
  destination: { consignee: string; address: string; port: string }
  details: { quoteNo: string; po: string; shipmentType: string; movement: string; term: string }
  commodities: { desc: string; pkg: string; gross: string; vol: string; chg: string }[]
  commTotal: { units: string; gross: string; vol: string; chg: string }
  quoteDate: string; validFrom: string; validTill: string; currency: string
  charges: PdfCharge[]
  subTotal: string; total: string
  notes: string[]
}

export type PdfRefs = {
  unitLabel: (code: string) => string
  taxLabel: (code: string) => string
  taxRateByCode: Record<string, number>
  port: (code: string | null) => { code: string; name: string; cc: string | null } | null
}

export type PdfCustomer = { name: string; contact: string; phone: string; email: string; address: string } | null

const COMPANY = { email: 'salessupport.nz@ubfreight.com', phone: '09 966 3850' }

const money = (cur: string, n: number) =>
  `${cur} ${n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const upDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '\u2014'

export function buildQuotePdfData(
  quote: QuoteRecord,
  response: QuoteResponseRecord,
  lines: QuoteResponseLine[],
  cargo: QuoteCargoLine[],
  containers: QuoteContainer[],
  customer: PdfCustomer,
  refs: PdfRefs,
): QuotePdfData {
  const currency = response.currency ?? 'NZD'
  const mode: 'air' | 'sea' = quote.shipment_mode === 'sea' ? 'sea' : 'air'
  const portLabel = mode === 'air' ? 'AIRPORT' : 'PORT'
  const fromP = refs.port(quote.from_port_code)
  const toP = refs.port(quote.to_port_code)

  let commodities: QuotePdfData['commodities'] = []
  let commTotal = { units: '', gross: '', vol: '', chg: '' }
  const nonEmptyCargo = cargo.filter((c) => c.cargo_description || c.gross_wt || c.total_cbm || c.chargeable_wt)
  if (nonEmptyCargo.length) {
    commodities = nonEmptyCargo.map((c) => ({
      desc: c.cargo_description || '',
      pkg: [c.packages ? `${c.packages} X` : '', c.package_type].filter(Boolean).join(' ') || '\u2014',
      gross: c.gross_wt ? `${c.gross_wt} KG` : '',
      vol: c.total_cbm || c.volume_cbm || '',
      chg: c.chargeable_wt ? `${c.chargeable_wt} KG` : '',
    }))
    commTotal = { units: `${nonEmptyCargo.length} LINE(S)`, gross: '', vol: '', chg: '' }
  } else if (containers.length) {
    commodities = containers.map((c) => ({
      desc: (c.commodity || '').toUpperCase(),
      pkg: `${c.qty} X ${c.container_size} ${c.container_type}`.toUpperCase(),
      gross: c.weight_per_container_mt != null ? `${c.weight_per_container_mt} MT/CTR` : '',
      vol: '',
      chg: '',
    }))
    const totalCtrs = containers.reduce((s, c) => s + (c.qty || 0), 0)
    commTotal = { units: `${totalCtrs} CONTAINER(S)`, gross: '', vol: '', chg: '' }
  }

  const GROUP_ORDER: { key: string; label: string }[] = [
    { key: 'origin', label: 'ORIGIN CHARGES' },
    { key: 'freight', label: 'FREIGHT CHARGES' },
    { key: 'destination', label: 'DESTINATION CHARGES' },
  ]
  const chargeLines = lines.filter((l) => l.description || l.sell_rate || l.buy_rate)
  const toRow = (l: QuoteResponseLine) => {
    const c = computeResponseLine(l)
    const sc = l.sell_currency || currency
    return {
      desc: l.description || '',
      qty: l.qty || '',
      unit: l.unit ? refs.unitLabel(l.unit) : '',
      min: l.min_sell ? money(sc, Number(l.min_sell)) : `${sc} 0.00`,
      price: money(sc, Number(l.sell_rate) || 0),
      ex: l.ex_rate_sell || '1',
      tax: l.tax ? refs.taxLabel(l.tax) : '',
      frcr: money(sc, (Number(l.qty) || 0) * c.effectiveSell),
      amt: money(currency, c.totalSell),
    }
  }
  const charges: PdfCharge[] = []
  for (const g of GROUP_ORDER) {
    const inGroup = chargeLines.filter((l) => (l.charge_group || 'freight') === g.key)
    if (!inGroup.length) continue
    charges.push({ grp: g.label })
    for (const l of inGroup) charges.push(toRow(l))
  }

  const totals = computeResponseTotals(lines, refs.taxRateByCode)
  const notes = (response.customer_notes || '')
    .split(/\r?\n/)
    .map((n) => n.replace(/^[-\u2022]\s*/, '').trim())
    .filter(Boolean)

  return {
    quoteNo: quote.quote_no || '',
    mode,
    company: COMPANY,
    from: fromP ? { code: fromP.code, name: fromP.name, cc: fromP.cc } : { code: quote.from_port_code || '', name: '', cc: null },
    to: toP ? { code: toP.code, name: toP.name, cc: toP.cc } : { code: quote.to_port_code || '', name: '', cc: null },
    portLabel,
    requestedBy: {
      company: customer?.name || quote.customer_name || '',
      contact: customer?.contact || '',
      address: customer?.address || '',
      phone: customer?.phone || '',
      email: customer?.email || '',
    },
    origin: { port: fromP ? `${fromP.code} - ${fromP.name.toUpperCase()}` : (quote.from_port_code || '') },
    destination: {
      consignee: (quote.consignee || quote.customer_name || '').toUpperCase(),
      address: quote.consignee_address || '',
      port: toP ? `${toP.code} - ${toP.name.toUpperCase()}` : (quote.to_port_code || ''),
    },
    details: {
      quoteNo: quote.quote_no || '',
      po: quote.customer_po || '\u2014',
      shipmentType: (quote.shipment_type || (mode === 'air' ? 'AIR CARGO' : 'SEA FREIGHT')).toUpperCase(),
      movement: (quote.movement_type || '').toUpperCase(),
      term: [quote.incoterms, quote.incoterm_place].filter(Boolean).join(' ').toUpperCase(),
    },
    commodities,
    commTotal,
    quoteDate: upDate(response.quotation_date),
    validFrom: upDate(response.valid_from),
    validTill: upDate(response.valid_till),
    currency,
    charges,
    subTotal: money(currency, totals.subTotal),
    total: money(currency, totals.subTotal + totals.totalTax),
    notes,
  }
}

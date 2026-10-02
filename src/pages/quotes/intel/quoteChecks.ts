import { resolveLegs, serviceTypeForIncoterm, legPayersFor, type ChargeLegs } from '../../rates/incotermLegs'
import type { QuoteResponseLine } from '../quoteResponseLinesApi'
import type { QuoteFacts } from './factsApi'

export type CheckLevel = 'ok' | 'warn' | 'info'
export type Check = { id: string; level: CheckLevel; text: string; sub?: string }
export type LegView = { key: 'origin' | 'freight' | 'dest'; label: string; billed: boolean; payer: string | null; lines: number }

const groupOf = (g: string): 'origin' | 'freight' | 'dest' => (g === 'origin' ? 'origin' : g === 'destination' ? 'dest' : 'freight')
const LBL = { origin: 'Origin', freight: 'Freight', dest: 'Destination' } as const
const short = (s: string | null) => (s ? s.split(',').slice(0, 2).join(',').trim() : '')

export function legsView(f: QuoteFacts, lines: QuoteResponseLine[] | null): { legs: ChargeLegs | null; view: LegView[] } {
  const legs = resolveLegs({ isAgent: !!f.agent_id, incoterm: f.incoterms, movement: f.movement_type, freightTerms: f.freight_terms })
  const payers = legPayersFor(f.incoterms)
  const count = { origin: 0, freight: 0, dest: 0 }
  for (const l of lines ?? []) if (l.description.trim()) count[groupOf(l.charge_group)]++
  const view = (['origin', 'freight', 'dest'] as const).map((k) => ({
    key: k, label: LBL[k], billed: legs ? legs[k] : false, payer: payers ? payers[k] : null, lines: count[k],
  }))
  return { legs, view }
}

export function buildChecks(f: QuoteFacts, lines: QuoteResponseLine[] | null): Check[] {
  const out: Check[] = []
  const inco = (f.incoterms || '').toUpperCase()
  const mv = (f.movement_type || '').toLowerCase()
  const isAgent = !!f.agent_id
  if (!inco) out.push({ id: 'inco', level: 'warn', text: 'No incoterm set', sub: 'Leg scope and address checks need it.' })
  if (mv !== 'import' && mv !== 'export') out.push({ id: 'mv', level: 'warn', text: 'Import or export not set' })

  const { legs, view } = legsView(f, lines)
  if (legs && lines) {
    for (const v of view) {
      if (!v.billed && v.lines > 0) out.push({ id: `extra-${v.key}`, level: 'warn', text: `${v.label} charges on quote, but customer doesn't pay this leg`,
        sub: isAgent ? 'Agent enquiry: check prepaid/collect.' : `${inco} ${mv}: ${v.payer === 'Seller' ? 'seller' : 'buyer'} pays ${v.label.toLowerCase()}.` })
      if (v.billed && v.lines === 0) out.push({ id: `none-${v.key}`, level: 'warn', text: `No ${v.label.toLowerCase()} charges on quote`, sub: `${inco || 'Scope'} puts ${v.label.toLowerCase()} on the customer.` })
    }
  }
  if (legs && !legs.origin && !legs.freight && !legs.dest && !isAgent) {
    out.push({ id: 'nolegs', level: 'info', text: `${inco} ${mv}: customer pays no legs`, sub: mv === 'export' ? 'Usually quoted to the overseas buyer or agent instead.' : 'Seller covers everything. Check who the quote is for.' })
  }
  if (inco === 'DDP') out.push({ id: 'ddp', level: 'info', text: 'DDP: duty and GST on the seller', sub: mv === 'import' ? 'Run the duty check below and include it.' : 'Get destination duty and clearance cost from the agent.' })

  const expSvc = serviceTypeForIncoterm(inco)
  if (expSvc && f.service_type && f.service_type !== expSvc) out.push({ id: 'svc', level: 'info', text: `Service ${f.service_type}, ${inco} usually ${expSvc}` })

  const svc = f.service_type || expSvc || ''
  const needPickup = svc.startsWith('Door') && (!legs || legs.origin)
  const needDrop = svc.endsWith('Door') && (!legs || legs.dest)
  if (needPickup) {
    if (!f.pickup_address && !f.pickup_postal_code) out.push({ id: 'pu', level: 'warn', text: 'Pickup address missing', sub: 'Door pickup in scope. Needed for cartage rate.' })
    else if (!f.pickup_postal_code) out.push({ id: 'pupc', level: 'info', text: 'Pickup postcode missing', sub: short(f.pickup_address) })
    else out.push({ id: 'pu-ok', level: 'ok', text: `Pickup ${short(f.pickup_address) || f.pickup_postal_code}` })
  }
  if (needDrop) {
    if (!f.drop_address && !f.drop_postal_code) out.push({ id: 'dr', level: 'warn', text: 'Delivery address missing', sub: 'Door delivery in scope. Needed for cartage rate.' })
    else if (!f.drop_postal_code) out.push({ id: 'drpc', level: 'info', text: 'Delivery postcode missing', sub: short(f.drop_address) })
    else out.push({ id: 'dr-ok', level: 'ok', text: `Delivery ${short(f.drop_address) || f.drop_postal_code}` })
  }
  if (isAgent && (needPickup || needDrop)) out.push({ id: 'agent', level: 'info', text: 'Agent enquiry: addresses are never auto-filled', sub: 'Confirm door addresses with the agent.' })

  if ((inco === 'CIF' || inco === 'CIP') && mv === 'export' && !f.need_insurance) out.push({ id: 'ins', level: 'warn', text: `${inco} export: seller must insure`, sub: 'Insurance not ticked on the quote.' })
  if (f.need_insurance && !f.cargo_value) out.push({ id: 'insv', level: 'warn', text: 'Insurance ticked, cargo value missing' })
  if (f.is_hazardous && (!f.dg_un_number || !f.dg_class)) out.push({ id: 'dg', level: 'warn', text: 'DG cargo: UN number or class missing' })
  if (f.need_refrigeration && f.reefer_temp_c == null) out.push({ id: 'rf', level: 'warn', text: 'Reefer: set temperature' })

  if (!out.some((c) => c.level !== 'ok')) out.unshift({ id: 'all', level: 'ok', text: 'Scope, addresses and cargo look complete' })
  const rank = { warn: 0, info: 1, ok: 2 } as const
  return out.sort((a, b) => rank[a.level] - rank[b.level])
}

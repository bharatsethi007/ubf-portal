import { Sparkles } from 'lucide-react'

type GapLine = { charge_group: string | null; buy_rate: string | number | null; sell_rate: string | number | null }

const num = (v: string | number | null) => Number(v) || 0

export type GapCtx = { incoterms?: string | null; movement_type?: string | null; service_type?: string | null }
type Needs = { origin: boolean; freight: boolean; dest: boolean }

const SELLER_ORIGIN = ['FCA', 'FAS', 'FOB']
const SELLER_FREIGHT = ['CFR', 'CIF', 'CPT', 'CIP']
const SELLER_DEST = ['DAP', 'DPU', 'DAT', 'DDU', 'DDP']

/**
 * Which charge groups this customer pays, from incoterm + direction.
 * Export: customer is the seller. Import: customer is the buyer.
 * No incoterm (or EXW on export): fall back to the service type (Door/Port ends).
 */
export function chargeNeeds(ctx?: GapCtx): Needs {
  const inc = (ctx?.incoterms ?? '').trim().toUpperCase().slice(0, 3)
  const dir = (ctx?.movement_type ?? '').toLowerCase()
  if (dir === 'export' && inc && inc !== 'EXW') {
    if (SELLER_ORIGIN.includes(inc)) return { origin: true, freight: false, dest: false }
    if (SELLER_FREIGHT.includes(inc)) return { origin: true, freight: true, dest: false }
    if (SELLER_DEST.includes(inc)) return { origin: true, freight: true, dest: true }
  }
  if (dir === 'import' && inc) {
    if (inc === 'EXW') return { origin: true, freight: true, dest: true }
    if (SELLER_ORIGIN.includes(inc)) return { origin: false, freight: true, dest: true }
    if (SELLER_FREIGHT.includes(inc) || SELLER_DEST.includes(inc)) return { origin: false, freight: false, dest: true }
  }
  const svc = (ctx?.service_type ?? '').toLowerCase()
  if (svc.includes(' to ')) {
    const [from, to] = svc.split(' to ')
    return { origin: from.includes('door') || dir === 'export', freight: true, dest: to.includes('door') || dir === 'import' }
  }
  return { origin: true, freight: true, dest: true }
}

/** What is still missing for the charges this customer pays. Live from the lines. */
export function responseGaps(lines: GapLine[], ctx?: GapCtx): string[] {
  const need = chargeNeeds(ctx)
  const groups = new Set(lines.map((l) => (l.charge_group ?? '').toLowerCase()))
  const gaps: string[] = []
  if (need.origin && !groups.has('origin')) gaps.push('Origin charges missing')
  if (need.freight && !groups.has('freight')) gaps.push('Freight charges missing')
  if (need.dest && !groups.has('dest') && !groups.has('destination')) gaps.push('Destination charges missing')
  // Only freight needs a carrier buy; UBF's own local fees are often sell-only.
  if (lines.some((l) => (l.charge_group ?? '').toLowerCase() === 'freight' && num(l.sell_rate) > 0 && num(l.buy_rate) === 0)) gaps.push('Freight buy rate not on file')
  return gaps
}

/** UBF Intelligence note shown above the charge lines while gaps remain. */
export function ResponseGapsNote({ lines, ai, ctx }: { lines: GapLine[]; ai: boolean; ctx?: GapCtx }) {
  const gaps = responseGaps(lines, ctx)
  if (!lines.length || !gaps.length) return null
  return (
    <div className="qr-gaps" role="note">
      <Sparkles size={15} />
      <div>
        <b>{ai ? 'UBF Intelligence: check this quote.' : 'Not a full quote yet.'}</b>
        <span> {gaps.join(' · ')}. Add them before sending for approval, or note on the quote that they are excluded.</span>
      </div>
    </div>
  )
}

import type { QuoteResponseLine } from '../quoteResponseLinesApi'
import type { IntelCharge } from './laneIntelApi'

// Words that say nothing about which charge a line is.
const STOP = new Set([
  'fee', 'fees', 'charge', 'charges', 'export', 'import', 'sea', 'air', 'the', 'and', 'of', 'for',
  'local', 'es', 'ea', 'is', 'ia', 'per', 'surcharge', 'service', 'services', 'freight', 'nz', 'fiji',
])

// Known synonyms per ERP code. Matching any one marks the charge as covered.
const SYN: Record<string, string[]> = {
  FES: ['ocean freight', 'sea freight', 'freight export', 'ofr', 'base rate', 'basic freight'],
  FIS: ['ocean freight', 'sea freight', 'ofr', 'base rate'],
  AFR: ['air freight', 'airfreight'], FEA: ['air freight', 'airfreight'], FIA: ['air freight', 'airfreight'],
  BL: ['bill of lading', 'b/l', 'bl fee', 'documentation', 'doc fee', 'docs'],
  CAD: ['clearance', 'customs', 'export entry', 'entry'],
  DEL: ['cartage', 'delivery', 'pickup', 'pick up', 'transport', 'collection'],
  CAR: ['cartage', 'delivery', 'pickup', 'pick up', 'transport', 'collection'],
  ETHC: ['terminal', 'thc', 'port handling'], ITHC: ['terminal', 'thc', 'port handling'], THC: ['terminal', 'thc'],
  VGM: ['vgm', 'solas', 'weighing'], MSW: ['maritime security', 'marine security', 'msw', 'security fee'],
  EDPS: ['edps', 'edi'], RAA: ['dangerous', 'hazardous', 'dg'], PAC: ['packing', 'pack'],
  INS: ['insurance'], STO: ['storage'], SCR: ['screening', 'x-ray', 'xray'],
}

function norm(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()} `
}
function tokens(s: string): string[] {
  return norm(s).trim().split(' ').filter((w) => w.length >= 4 && !STOP.has(w))
}

export function lineCoversCharge(line: QuoteResponseLine, c: IntelCharge): boolean {
  const d = norm(line.description)
  if (d.trim() === '') return false
  if (d.includes(` ${c.code.toLowerCase()} `)) return true
  for (const s of SYN[c.code] ?? []) if (d.includes(norm(s).trim())) return true
  const want = new Set([...tokens(c.description), ...tokens(c.erpDescription ?? '')])
  return tokens(line.description).some((w) => want.has(w))
}

export type ChargeStatus = 'covered' | 'missing' | 'optional'
export type CheckedCharge = IntelCharge & { status: ChargeStatus; onCustomer: boolean }

/** Charges seen on >= 50% of lane jobs (or always billed to this customer) are expected. */
export function checkCharges(
  charges: IntelCharge[], lines: QuoteResponseLine[] | null, customerCodes: string[],
): CheckedCharge[] {
  const cust = new Set(customerCodes)
  const rows = charges.map((c) => {
    const onCustomer = cust.has(c.code)
    const covered = lines ? lines.some((l) => lineCoversCharge(l, c)) : false
    const expected = c.pct >= 50 || onCustomer
    const status: ChargeStatus = covered ? 'covered' : expected ? 'missing' : 'optional'
    return { ...c, status, onCustomer }
  })
  const rank = { missing: 0, covered: 1, optional: 2 } as const
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || b.pct - a.pct)
}

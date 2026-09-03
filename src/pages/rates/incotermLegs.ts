// Which of the three legs — origin → freight → destination — the CUSTOMER is
// responsible for (hence the legs we quote and must find a rate for).
//
// `pivot` = number of legs the SELLER bears, counted from the origin side.
//   Export: our customer is the seller  → they pay the first `pivot` legs.
//   Import: our customer is the buyer   → they pay the legs after `pivot`.
//
// This is the "inverts for export" rule. Adjust a cell here if a term should map
// differently for UBF — it's the single source of truth for leg scope.
export type ChargeLegs = { origin: boolean; freight: boolean; dest: boolean }

const PIVOT: Record<string, number> = {
  EXW: 0,
  FCA: 1, FAS: 1, FOB: 1,
  CFR: 2, CIF: 2, CPT: 2, CIP: 2, DAP: 2, DPU: 2,
  DDP: 3,
}

// Returns null when incoterm or movement is unknown — the caller then falls back
// to showing whatever rates it found, with no incoterm-based warnings.
export function chargeLegsFor(
  incoterm: string | null | undefined,
  movement: string | null | undefined,
): ChargeLegs | null {
  const code = (incoterm || '').toUpperCase()
  const mv = (movement || '').toLowerCase()
  const pivot = PIVOT[code]
  if (pivot == null || (mv !== 'import' && mv !== 'export')) return null
  const order: (keyof ChargeLegs)[] = ['origin', 'freight', 'dest']
  const isExport = mv === 'export'
  const legs: ChargeLegs = { origin: false, freight: false, dest: false }
  order.forEach((k, i) => { legs[k] = isExport ? i < pivot : i >= pivot })
  return legs
}

// Default forwarder movement scope (origin endpoint → destination endpoint)
// implied by an incoterm. A single incoterm only fixes one handover point, so
// these are sensible starting defaults the user can override on the quote:
//   EXW/FCA  → origin pickup at the door
//   F*/C*    → port-to-port main carriage
//   DAP/DPU  → delivered to the destination door
//   DDP      → full door-to-door
const SERVICE_TYPE: Record<string, string> = {
  EXW: 'Door to Port',
  FCA: 'Door to Port',
  FAS: 'Port to Port',
  FOB: 'Port to Port',
  CFR: 'Port to Port',
  CIF: 'Port to Port',
  CPT: 'Port to Port',
  CIP: 'Port to Port',
  DAP: 'Port to Door',
  DPU: 'Port to Door',
  DDP: 'Door to Door',
}

export function serviceTypeForIncoterm(incoterm: string | null | undefined): string | null {
  return SERVICE_TYPE[(incoterm || '').toUpperCase()] ?? null
}

// Absolute payer per leg (independent of who our customer is): the seller bears the
// first `pivot` legs, the buyer bears the rest. Drives the Buyer/Seller bubbles.
export type LegPayer = 'Seller' | 'Buyer'

export function legPayersFor(
  incoterm: string | null | undefined,
): { origin: LegPayer; freight: LegPayer; dest: LegPayer } | null {
  const pivot = PIVOT[(incoterm || '').toUpperCase()]
  if (pivot == null) return null
  const order: (keyof ChargeLegs)[] = ['origin', 'freight', 'dest']
  const out: { origin: LegPayer; freight: LegPayer; dest: LegPayer } = { origin: 'Buyer', freight: 'Buyer', dest: 'Buyer' }
  order.forEach((k, i) => { out[k] = i < pivot ? 'Seller' : 'Buyer' })
  return out
}

// ---------------------------------------------------------------------------
// Completeness (advisory, never blocks). Given the incoterm leg scope + service
// type + which priced sources the matcher actually found, list what's required
// for this incoterm/direction but missing. Cartage (door legs) is required only
// when the service type starts/ends "Door" and a pickup/drop address is present.
export type FoundSources = {
  freight: boolean
  originCharges: boolean
  destCharges: boolean
  originCartage: boolean
  destCartage: boolean
}

export type Completeness = { complete: boolean; missing: string[] }

export function completenessFor(
  incoterm: string | null | undefined,
  movement: string | null | undefined,
  found: FoundSources,
  opts?: { hasPickup?: boolean; hasDelivery?: boolean },
): Completeness {
  const legs = chargeLegsFor(incoterm, movement)
  if (!legs) return { complete: true, missing: [] } // unknown term → no warnings
  const svc = serviceTypeForIncoterm(incoterm) || ''
  const startsDoor = /^Door/i.test(svc)
  const endsDoor = /Door$/i.test(svc)
  const missing: string[] = []
  if (legs.freight && !found.freight) missing.push('Freight')
  if (legs.origin) {
    if (!found.originCharges) missing.push('Origin charges')
    if (startsDoor && (opts?.hasPickup ?? true) && !found.originCartage) missing.push('Origin cartage (pickup)')
  }
  if (legs.dest) {
    if (!found.destCharges) missing.push('Destination charges')
    if (endsDoor && (opts?.hasDelivery ?? true) && !found.destCartage) missing.push('Destination cartage (delivery)')
  }
  return { complete: missing.length === 0, missing }
}

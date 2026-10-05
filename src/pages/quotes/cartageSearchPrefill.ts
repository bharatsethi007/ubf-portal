import { fetchQuote } from './quotesApi'
import { fetchQuoteCargo } from './quoteCargoApi'
import { fetchQuoteContainers } from './quoteContainersApi'
import type { FclUnit } from './intel/cartageSuggest'
import type { CartageDoor, CartageKind, CartageLeg } from './cartageSearchRun'

export type CartagePrefill = {
  leg: CartageLeg; legFixed: boolean
  ports: Record<CartageLeg, string>; doors: Record<CartageLeg, CartageDoor>
  kind: CartageKind; pcs: number; kg: number; cbm: number; fcl: FclUnit[]
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r3 = (n: number) => Math.round(n * 1000) / 1000

/** Leg, door, ports and pcs/kg/cbm from the quote request. */
export async function loadCartagePrefill(quoteId: string): Promise<CartagePrefill> {
  const [q, cargo, ctrs] = await Promise.all([fetchQuote(quoteId), fetchQuoteCargo(quoteId), fetchQuoteContainers(quoteId)])
  if (!q) throw new Error('Quote not found')
  const mv = (q.movement_type ?? '').toLowerCase()
  const doors: Record<CartageLeg, CartageDoor> = {
    origin: { suburb: q.pickup_location ?? '', postcode: q.pickup_postal_code ?? '', address: q.pickup_address ?? q.shipper_address ?? '' },
    dest: { suburb: q.drop_location ?? '', postcode: q.drop_postal_code ?? '', address: q.drop_address ?? q.consignee_address ?? '' },
  }
  const leg: CartageLeg = mv === 'export' ? 'origin' : mv === 'import' ? 'dest'
    : (doors.origin.suburb || doors.origin.postcode ? 'origin' : 'dest')

  const type = (q.shipment_type ?? '').toUpperCase()
  const live = cargo.filter((c) => c.gross_wt || c.total_cbm || c.volume_cbm)
  const fcl: FclUnit[] = ctrs.filter((c) => (c.qty ?? 0) > 0).map((c) => ({
    size: String(c.container_size).startsWith('40') ? '40' : '20', qty: c.qty ?? 0, kgPer: num(c.weight_per_container_mt) * 1000,
  }))
  const kind: CartageKind = q.shipment_mode === 'air' || type.includes('AIR') ? 'air'
    : type.includes('LCL') ? 'lcl' : type.includes('FCL') || (fcl.length && !live.length) ? 'fcl' : 'lcl'

  return {
    leg, legFixed: mv === 'export' || mv === 'import',
    ports: { origin: q.from_port_code ?? '', dest: q.to_port_code ?? '' },
    doors, kind, fcl,
    pcs: live.reduce((s, c) => s + num(c.packages || c.quantity), 0),
    kg: r3(live.reduce((s, c) => s + num(c.gross_wt), 0)),
    cbm: r3(live.reduce((s, c) => s + num(c.total_cbm || c.volume_cbm), 0)),
  }
}

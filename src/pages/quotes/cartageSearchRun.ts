import { runCartageRate, runGssCartage, runBascikCartage } from './cartageSearchApi'
import { PORT_CITY, DEPOT, type FclUnit } from './intel/cartageSuggest'

export type CartageKind = 'fcl' | 'lcl' | 'air'
export type CartageLeg = 'origin' | 'dest'
export type CartageDoor = { suburb: string; postcode: string; address: string }
export type CartageOpt = { key: string; carrier: string; service: string; cost: number; charge: number; source: 'ubf' | 'gss' | 'bascik'; rural?: boolean }
export type CartageSearchInput = {
  leg: CartageLeg; port: string; door: CartageDoor; kind: CartageKind
  pcs: number; kg: number; cbm: number; fcl: FclUnit[]
  residential: boolean; tailLift: boolean
}
export type CartageSearchResult = { options: CartageOpt[]; ubfStatus: string; notes: string[] }

/** UBF own card + (LCL/Air) GoSweetSpot and Bascik, merged and sorted cheapest first. */
export async function searchCartage(i: CartageSearchInput): Promise<CartageSearchResult> {
  const port = i.port.trim().toUpperCase()
  const dir = i.leg === 'origin' ? 'export' as const : 'import' as const
  const common = {
    door_postcode: i.door.postcode || null, door_city: i.door.suburb || null, door_raw: i.door.address || null,
    port_code: port, direction: dir, residential: i.residential, tail_lift: i.tailLift,
  }
  const notes: string[] = []

  // 1. UBF own rate card
  let ubfStatus = 'ok', ubfAmt = 0
  try {
    if (i.kind === 'fcl') {
      const units = i.fcl.filter((u) => u.qty > 0)
      if (!units.length) ubfStatus = 'no_cargo'
      for (const u of units) {
        const r = await runCartageRate({ ...common, mode: u.size === '40' ? 'fcl40' : 'fcl20', weight_kg: u.kgPer, cbm: 0, volume_cm3: 0 })
        if (r.status !== 'ok') { ubfStatus = r.status; break }
        ubfAmt += (r.total ?? 0) * u.qty
      }
    } else {
      const r = await runCartageRate({ ...common, mode: i.kind, weight_kg: i.kg, cbm: i.kind === 'lcl' ? i.cbm : 0, volume_cm3: i.kind === 'air' ? Math.round(i.cbm * 1e6) : 0 })
      ubfStatus = r.status
      if (r.status === 'ok') ubfAmt = r.total ?? 0
    }
  } catch { ubfStatus = 'error' }
  const options: CartageOpt[] = []
  if (ubfStatus === 'ok' && ubfAmt > 0) options.push({ key: 'ubf', carrier: 'UBF', service: '', cost: ubfAmt, charge: ubfAmt, source: 'ubf' })

  // 2. Couriers (LTL only)
  if (i.kind !== 'fcl') {
    const city = PORT_CITY[port]
    const doorCity = i.door.suburb || i.door.address.split(',')[0]
    if (!city) notes.push(`No courier lookup for port ${port}`)
    else if (!doorCity) notes.push('Enter door suburb for courier rates')
    else {
      const portAddr = DEPOT[port] ?? { suburb: city, city }
      const door = { suburb: i.door.suburb || undefined, city: i.door.suburb || undefined, postcode: i.door.postcode || undefined, street: i.door.address || undefined }
      const [o, d] = dir === 'import' ? [portAddr, door] : [door, portAddr]
      // Bascik rates by town: send suburb + full address so it can find the city (e.g. Harewood -> Christchurch).
      const doorTown = [i.door.suburb, i.door.address].filter(Boolean).join(', ')
      const [fromS, toS] = dir === 'import' ? [city, doorTown] : [doorTown, city]
      const pcs = Math.max(1, i.pcs || 1)
      const [gss, bas] = await Promise.all([
        runGssCartage({ origin: o, destination: d, pieces: pcs, weight_kg: i.kg, volume_m3: i.cbm }),
        runBascikCartage({ from_suburb: fromS, to_suburb: toS, pieces: pcs, weight_kg: i.kg, volume_m3: i.cbm }),
      ])
      if (gss.ok && gss.options) gss.options.forEach((g, n) => options.push({ key: `gss${n}`, carrier: g.carrier, service: g.service, cost: g.cost, charge: g.charge || g.cost, source: 'gss', rural: g.rural }))
      else if (!gss.ok) notes.push(`GoSweetSpot: ${gss.reason ?? 'no rates'}`)
      if (bas.ok && bas.options) bas.options.forEach((b, n) => options.push({ key: `bas${n}`, carrier: 'Bascik', service: b.service, cost: b.cost, charge: b.cost, source: 'bascik' }))
      else if (!bas.ok) notes.push(`Bascik: ${bas.reason ?? 'no rates'}`)
    }
  }
  options.sort((a, b) => a.charge - b.charge)
  return { options, ubfStatus, notes }
}

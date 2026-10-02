import { runCartageRate, runGssCartage, type GssOption } from '../cartageSearchApi'
import type { QuoteResponseLine } from '../quoteResponseLinesApi'
import type { RateOptionCartage } from '../rateOptionCartage'
import type { QuoteFacts } from './factsApi'

export type FclUnit = { size: '20' | '40'; qty: number; kgPer: number }
export type CartageInput = {
  kind: 'fcl' | 'lcl' | 'air'; from: string; to: string; facts: QuoteFacts
  legBilled: boolean; lines: QuoteResponseLine[]
  kg: number | null; cbm: number | null; fcl: FclUnit[]
}
export type CartageSuggestion =
  | { status: 'ok'; cartage: RateOptionCartage; door: string; port: string; alt: GssOption[] }
  | { status: 'no_zone' | 'no_lane'; door: string; port: string; leg: 'origin' | 'dest' }

// Port city + depot street for courier rating (goods clear at the port city).
const PORT_CITY: Record<string, string> = {
  NZAKL: 'Auckland', AKL: 'Auckland', NZTRG: 'Tauranga', NZWLG: 'Wellington', WLG: 'Wellington',
  NZLYT: 'Christchurch', CHC: 'Christchurch', NZNPE: 'Napier', NZNPL: 'New Plymouth', NZNSN: 'Nelson', NZDUD: 'Dunedin', NZBLU: 'Invercargill',
}
const DEPOT: Record<string, { street: string; suburb: string; city: string; postcode: string }> = {
  AKL: { street: '173 Montgomerie Road', suburb: 'Mangere', city: 'Auckland', postcode: '2022' },
  NZAKL: { street: '173 Montgomerie Road', suburb: 'Mangere', city: 'Auckland', postcode: '2022' },
}
const CARTAGE_WORDS = /cartage|delivery|pick ?up|collection|transport|trucking|courier/i

export function cartageLeg(i: CartageInput) {
  const mv = (i.facts.movement_type ?? '').toLowerCase()
  if (mv === 'export') return { leg: 'origin' as const, dir: 'export' as const, port: i.from, pc: i.facts.pickup_postal_code, city: i.facts.pickup_location, raw: i.facts.pickup_address }
  if (mv === 'import') return { leg: 'dest' as const, dir: 'import' as const, port: i.to, pc: i.facts.drop_postal_code, city: i.facts.drop_location, raw: i.facts.drop_address }
  return null
}

/** Null when cartage isn't in scope, the door is unknown, or the option already carries a cartage line. */
export async function suggestCartage(i: CartageInput): Promise<CartageSuggestion | null> {
  const L = cartageLeg(i)
  if (!L || !i.legBilled || !(L.pc || L.city || L.raw)) return null
  const group = L.leg === 'origin' ? 'origin' : 'destination'
  if (i.lines.some((l) => (l.charge_group === group || l.charge_group === L.leg) && CARTAGE_WORDS.test(l.description))) return null
  const door = L.pc || L.city || (L.raw ?? '').split(',')[0]
  const common = { door_postcode: L.pc, door_city: L.city, door_raw: L.raw, port_code: L.port, direction: L.dir, residential: false, tail_lift: false }

  let amount = 0, status = 'ok', conf = 'green'
  if (i.kind === 'fcl') {
    const units = i.fcl.filter((u) => u.qty > 0)
    if (!units.length) return null
    for (const u of units) {
      const r = await runCartageRate({ ...common, mode: u.size === '40' ? 'fcl40' : 'fcl20', weight_kg: u.kgPer, cbm: 0, volume_cm3: 0 })
      if (r.status !== 'ok') { status = r.status; break }
      amount += (r.total ?? 0) * u.qty
      if (r.door_confidence && r.door_confidence !== 'green') conf = r.door_confidence
    }
  } else {
    const kg = i.kg ?? 0, cbm = i.cbm ?? 0
    if (!kg && !cbm) return null
    const r = await runCartageRate({ ...common, mode: i.kind, weight_kg: kg, cbm: i.kind === 'lcl' ? cbm : 0, volume_cm3: i.kind === 'air' ? Math.round(cbm * 1e6) : 0 })
    if (r.status === 'ok') { amount = r.total ?? 0; conf = r.door_confidence ?? 'green' } else status = r.status
  }
  const label = L.leg === 'origin' ? `Cartage · pickup → ${L.port}` : `Cartage · ${L.port} → delivery`
  const isAkl = ['NZAKL', 'AKL'].includes(L.port.toUpperCase())

  // Auckland: UBF trucks it whenever our own card prices it.
  if (status === 'ok' && amount > 0 && (isAkl || i.kind === 'fcl')) {
    return { status: 'ok', door, port: L.port, alt: [], cartage: { leg: L.leg, label, amount, confidence: conf, status: 'ok', source: 'ubf', carrier: 'UBF', carrierShort: 'UBF' } }
  }
  // LTL elsewhere (or own card missed): cheapest courier via GoSweetSpot, UBF included if it priced.
  if (i.kind !== 'fcl') {
    const city = PORT_CITY[L.port.toUpperCase()]
    if (city) {
      const portAddr = DEPOT[L.port.toUpperCase()] ?? { suburb: city, city }
      const doorAddr = { suburb: L.city ?? undefined, city: L.city ?? undefined, postcode: L.pc ?? undefined, street: L.raw ?? undefined }
      const [o, d] = L.dir === 'import' ? [portAddr, doorAddr] : [doorAddr, portAddr]
      const g = await runGssCartage({ origin: o, destination: d, pieces: 1, weight_kg: i.kg ?? 0, volume_m3: i.cbm ?? 0 })
      const opts = [...(status === 'ok' && amount > 0 ? [{ carrier: 'UBF', service: '', cost: amount, charge: amount, rural: false, quoteId: null }] : []),
        ...(g.ok && g.options ? g.options : [])].sort((a, b) => (a.charge || a.cost) - (b.charge || b.cost))
      const best = opts[0]
      if (best) {
        const ubf = best.carrier === 'UBF'
        return { status: 'ok', door, port: L.port, alt: opts.slice(1, 3), cartage: {
          leg: L.leg, label: ubf ? label : `${label} · ${best.service || best.carrier}`, amount: best.charge || best.cost, cost: best.cost,
          confidence: 'green', status: 'ok', source: ubf ? 'ubf' : 'gss', carrier: best.carrier, carrierShort: best.carrier } }
      }
    }
  }
  return { status: status === 'no_zone' ? 'no_zone' : 'no_lane', door, port: L.port, leg: L.leg }
}

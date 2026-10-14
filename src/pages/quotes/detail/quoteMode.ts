import { supabase } from '@/supabase'
import { findAirport } from '@/utils/filterAirports'
import type { SeaPort } from '@/hooks/useSeaPorts'
import { updateQuote, type QuoteRecord } from '../quotesApi'
import { saveQuoteCargo, type QuoteCargoLine } from '../quoteCargoApi'

export type QuoteMode = 'FCL' | 'LCL' | 'Air'
export const MODES: QuoteMode[] = ['FCL', 'LCL', 'Air']

/** Same rules the page always used: Air wins, then LCL, else FCL. */
export function modeOf(type: string | null, mode: string | null): QuoteMode {
  if ((type ?? '').toUpperCase() === 'AIR' || /air/i.test(mode ?? '')) return 'Air'
  if ((type ?? '').toUpperCase() === 'LCL') return 'LCL'
  return 'FCL'
}

const PATCH: Record<QuoteMode, { shipment_type: string; shipment_mode: string }> = {
  FCL: { shipment_type: 'FCL', shipment_mode: 'sea' },
  LCL: { shipment_type: 'LCL', shipment_mode: 'sea' },
  Air: { shipment_type: 'Air', shipment_mode: 'air' },
}

const isSea = (m: QuoteMode) => m !== 'Air'

/**
 * Sea UN/LOCODE <-> airport IATA. NZAKL <-> AKL, FJSUV <-> SUV, FJNAN <-> NAN.
 * Only accepts a match when the country agrees, otherwise returns null (staff pick again).
 */
export function convertPort(code: string | null, from: QuoteMode, to: QuoteMode, seaPorts: SeaPort[]): string | null {
  if (!code) return null
  if (isSea(from) === isSea(to)) return code
  const c = code.trim().toUpperCase()
  if (to === 'Air') {
    if (c.length !== 5) return null
    const a = findAirport(c.slice(2))
    return a && a.country.toUpperCase() === c.slice(0, 2) ? a.iata : null
  }
  const a = findAirport(c)
  if (!a) return null
  const cand = `${a.country.toUpperCase()}${a.iata}`
  return seaPorts.some((p) => p.code.toUpperCase() === cand) ? cand : null
}

export type PortMove = { old: string | null; next: string | null }
export type ModePlan = { from: QuoteMode; to: QuoteMode; origin: PortMove; dest: PortMove; notes: string[] }

async function countResponses(quoteId: string): Promise<number> {
  const { count } = await supabase.from('quote_responses').select('id', { count: 'exact', head: true }).eq('quote_id', quoteId)
  return count ?? 0
}

/** Everything that changes when the mode flips, in plain words, before anything is saved. */
export async function planModeChange(q: QuoteRecord, from: QuoteMode, to: QuoteMode, seaPorts: SeaPort[]): Promise<ModePlan> {
  const origin = { old: q.from_port_code, next: convertPort(q.from_port_code, from, to, seaPorts) }
  const dest = { old: q.to_port_code, next: convertPort(q.to_port_code, from, to, seaPorts) }
  const notes: string[] = []
  for (const [label, m] of [['Origin', origin], ['Destination', dest]] as const) {
    if (!m.old || m.old === m.next) continue
    notes.push(m.next ? `${label} ${m.old} becomes ${m.next}.` : `${label} ${m.old} has no ${to === 'Air' ? 'airport' : 'sea port'} match. Pick it again.`)
  }
  if (from === 'FCL') notes.push('Containers are kept but hidden. Enter cargo lines.')
  else if (to === 'FCL') notes.push('Cargo lines are kept but hidden. Add containers.')
  else notes.push(to === 'Air' ? 'Chargeable recalculated as air weight (167 kg per m³).' : 'Chargeable switches to cubic metres.')
  const n = await countResponses(q.id)
  if (n) notes.push(`${n} response${n === 1 ? '' : 's'} priced as ${from} stay on this quote. Re-price before sending.`)
  return { from, to, origin, dest, notes }
}

export async function applyModeChange(quoteId: string, plan: ModePlan, lines: QuoteCargoLine[]): Promise<void> {
  await updateQuote(quoteId, { ...PATCH[plan.to], from_port_code: plan.origin.next, to_port_code: plan.dest.next })
  // LCL <-> Air keeps the same lines; re-save so chargeable weight follows the new mode.
  if (plan.from !== 'FCL' && plan.to !== 'FCL' && lines.length) await saveQuoteCargo(quoteId, lines, plan.to === 'Air' ? 'air' : 'sea')
}

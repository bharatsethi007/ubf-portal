// Booked dimension lines: load for editing, save back, and describe per piece.
import { supabase } from '@/supabase'
import { emptyLine, lineCbm, lineTotals, type Line } from './EaCargoLines'
import type { CargoLine } from './useEaBooking'

const VOL = 167
/** Lines in cm and kg whatever unit they were captured in. */
export const toCm = (v: number | null, u: string | null) => (v == null ? null : /^in/i.test(u ?? '') ? v * 2.54 : /^m$/i.test(u ?? '') ? v * 100 : v)
export const toKg = (v: number | null, u: string | null) => (v == null ? null : /^lb/i.test(u ?? '') ? v * 0.453592 : v)
const str = (v: number | null | undefined) => (v == null ? '' : String(Math.round(Number(v) * 100) / 100))

/** Editor rows from saved booked lines; falls back to the booking totals as one line. */
export function linesForEdit(ls: CargoLine[], b: { pieces: number | null; weight_kg: number | null; volume_m3: number | null }): Line[] {
  const bk = ls.filter((l) => l.kind === 'booked').sort((a, c) => (a.ord ?? 0) - (c.ord ?? 0))
  if (bk.length) {
    return bk.map((l) => {
      const dims = l.length && l.width && l.height
      return {
        pcs: str(l.pieces), l: str(toCm(l.length, l.length_unit)), w: str(toCm(l.width, l.length_unit)), h: str(toCm(l.height, l.length_unit)),
        kg: str(toKg(l.weight, l.weight_unit)), m3: dims ? '' : str(l.cbm),
      }
    })
  }
  if (b.pieces || b.weight_kg || b.volume_m3) return [{ ...emptyLine(), pcs: str(b.pieces), kg: str(b.weight_kg), m3: str(b.volume_m3) }]
  return [emptyLine()]
}

const num = (s: string | undefined) => (s && s.trim() ? Number(s) : null)

/** DB rows for booked lines. */
export function lineRows(bookingId: string, lines: Line[], goods: string | null) {
  return lines
    .filter((x) => x.pcs || x.kg || x.l || x.m3)
    .map((x, i) => ({
      booking_id: bookingId, ord: i + 1, kind: 'booked',
      pieces: num(x.pcs), length: num(x.l), width: num(x.w), height: num(x.h), length_unit: 'cm', weight_unit: 'kg',
      weight: num(x.kg), cbm: lineCbm(x) == null ? null : Number((lineCbm(x) ?? 0).toFixed(4)), goods_desc: i === 0 ? goods : null,
    }))
}

/** Booking totals that follow from the lines. Chargeable = max(actual, m³ × 167). */
export function totalsPatch(lines: Line[]) {
  const t = lineTotals(lines)
  return { pieces: t.pcs || null, weight_kg: t.kg || null, gross_weight_kg: t.kg || null, volume_m3: t.cbm, cbm: t.cbm, chargeable_weight_kg: t.chg || null }
}

/** Replace the booked lines (warehouse actuals are left alone). */
export async function saveBookedLines(bookingId: string, lines: Line[], goods: string | null) {
  const del = await supabase.from('booking_cargo_lines').delete().eq('booking_id', bookingId).eq('kind', 'booked')
  if (del.error) throw new Error(del.error.message)
  const rows = lineRows(bookingId, lines, goods)
  if (rows.length) {
    const { error } = await supabase.from('booking_cargo_lines').insert(rows)
    if (error) throw new Error(`Cargo lines failed: ${error.message}`)
  }
}

export type PieceView = { pcs: number; dims: string | null; kgEach: number | null; kg: number | null; cbmEach: number | null; cbm: number | null; vol: number | null }

/** One saved line described per piece and as a line total. */
export function pieceView(l: CargoLine): PieceView {
  const pcs = Number(l.pieces ?? 1) || 1
  const [L, W, H] = [toCm(l.length, l.length_unit), toCm(l.width, l.length_unit), toCm(l.height, l.length_unit)]
  const kg = toKg(l.weight, l.weight_unit)
  const cbm = L && W && H ? (pcs * L * W * H) / 1_000_000 : l.cbm
  const r = (v: number) => Math.round(v * 10) / 10
  return {
    pcs, dims: L && W && H ? `${r(L)} × ${r(W)} × ${r(H)} cm` : null,
    kg, kgEach: kg != null ? kg / pcs : null, cbm, cbmEach: cbm != null ? cbm / pcs : null, vol: cbm != null ? Math.ceil(cbm * VOL) : null,
  }
}

/** Lines that describe the cargo now: warehouse actuals when present, else booked. */
export const currentLines = (ls: CargoLine[]) => {
  const act = ls.filter((l) => l.kind === 'actual')
  return { kind: act.length ? 'actual' as const : 'booked' as const, lines: (act.length ? act : ls.filter((l) => l.kind === 'booked')).sort((a, c) => (a.ord ?? 0) - (c.ord ?? 0)) }
}

import type { Booking } from '../../types/booking'
import type { BookingCargoLine, CargoLineRow, LengthUnit, WeightUnit } from '../../types/bookingCargoLine'

export function newCargoLine(): CargoLineRow {
  return {
    id: crypto.randomUUID(),
    goodsDesc: '',
    pieces: '',
    lengthUnit: 'CM',
    length: '',
    width: '',
    height: '',
    cbm: '',
    weightUnit: 'KG',
    weight: '',
  }
}

function parseNum(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function dimToMetres(value: number, unit: LengthUnit): number {
  if (unit === 'CM') return value / 100
  if (unit === 'M') return value
  return value * 0.0254
}

export function computeRowCbm(line: CargoLineRow): number | null {
  const pieces = parseNum(line.pieces)
  const l = parseNum(line.length)
  const w = parseNum(line.width)
  const h = parseNum(line.height)
  if (pieces != null && l != null && w != null && h != null) {
    const cbm = dimToMetres(l, line.lengthUnit) * dimToMetres(w, line.lengthUnit) * dimToMetres(h, line.lengthUnit) * pieces
    return Math.round(cbm * 10000) / 10000
  }
  const stored = parseNum(line.cbm)
  return stored
}

function weightToKg(weight: number, unit: WeightUnit): number {
  return unit === 'LB' ? weight * 0.453592 : weight
}

export type CargoTotals = {
  totalPieces: number | null
  totalCbm: number | null
  totalWeightKg: number | null
  chargeableWeightKg: number | null
}

export function computeCargoTotals(lines: CargoLineRow[]): CargoTotals {
  let totalPieces = 0
  let totalCbm = 0
  let totalWeightKg = 0
  let hasPieces = false
  let hasCbm = false
  let hasWeight = false

  for (const line of lines) {
    const p = parseNum(line.pieces)
    if (p != null) {
      totalPieces += p
      hasPieces = true
    }
    const cbm = computeRowCbm(line)
    if (cbm != null) {
      totalCbm += cbm
      hasCbm = true
    }
    const w = parseNum(line.weight)
    if (w != null) {
      totalWeightKg += weightToKg(w, line.weightUnit)
      hasWeight = true
    }
  }

  const roundedCbm = hasCbm ? Math.round(totalCbm * 10000) / 10000 : null
  const roundedWeight = hasWeight ? Math.round(totalWeightKg * 100) / 100 : null
  const chargeable = roundedCbm != null || roundedWeight != null
    ? Math.round(Math.max(roundedWeight ?? 0, (roundedCbm ?? 0) * 167) * 100) / 100
    : null

  return {
    totalPieces: hasPieces ? totalPieces : null,
    totalCbm: roundedCbm,
    totalWeightKg: roundedWeight,
    chargeableWeightKg: chargeable,
  }
}

export function cargoLineFromDb(row: BookingCargoLine): CargoLineRow {
  return {
    id: row.id || crypto.randomUUID(),
    goodsDesc: row.goods_desc ?? '',
    pieces: row.pieces == null ? '' : String(row.pieces),
    lengthUnit: row.length_unit ?? 'CM',
    length: row.length == null ? '' : String(row.length),
    width: row.width == null ? '' : String(row.width),
    height: row.height == null ? '' : String(row.height),
    cbm: row.cbm == null ? '' : String(row.cbm),
    weightUnit: row.weight_unit ?? 'KG',
    weight: row.weight == null ? '' : String(row.weight),
  }
}

export function cargoLineToDb(row: CargoLineRow, ord: number): Partial<BookingCargoLine> {
  const cbm = computeRowCbm(row)
  const pieces = parseNum(row.pieces)
  return {
    ord,
    pieces: pieces != null ? Math.trunc(pieces) : null,
    length_unit: row.lengthUnit,
    length: parseNum(row.length),
    width: parseNum(row.width),
    height: parseNum(row.height),
    cbm,
    weight_unit: row.weightUnit,
    weight: parseNum(row.weight),
    goods_desc: row.goodsDesc.trim() || null,
  }
}

export function isCargoLineEmpty(row: CargoLineRow): boolean {
  return !row.goodsDesc.trim() && !row.pieces.trim() && !row.length.trim()
    && !row.width.trim() && !row.height.trim() && !row.weight.trim() && !row.cbm.trim()
}

export function cargoLinesFromDb(rows: BookingCargoLine[]): CargoLineRow[] {
  return rows.length ? rows.map(cargoLineFromDb) : [newCargoLine()]
}

export function cargoLinesFromBookingHeader(booking: Booking): CargoLineRow[] {
  const hasData = booking.pieces != null || booking.gross_weight_kg != null || booking.weight_kg != null
    || booking.goods_description || booking.length_cm != null || booking.volume_m3 != null
  if (!hasData) return [newCargoLine()]
  return [{
    ...newCargoLine(),
    goodsDesc: booking.goods_description ?? '',
    pieces: booking.pieces != null ? String(booking.pieces) : '',
    lengthUnit: 'CM',
    length: booking.length_cm != null ? String(booking.length_cm) : '',
    width: booking.width_cm != null ? String(booking.width_cm) : '',
    height: booking.height_cm != null ? String(booking.height_cm) : '',
    cbm: booking.volume_m3 != null ? String(booking.volume_m3) : '',
    weightUnit: 'KG',
    weight: booking.gross_weight_kg != null ? String(booking.gross_weight_kg)
      : booking.weight_kg != null ? String(booking.weight_kg) : '',
  }]
}

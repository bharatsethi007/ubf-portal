import { computeCargoLine, newQuoteCargoLine, type QuoteCargoLine } from './quoteCargoApi'

const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Total mode works on typed totals. A typed total CBM beats leftover dimensions,
 * a typed total weight beats a leftover per-piece weight.
 */
export function cleanTotalLine(line: QuoteCargoLine): QuoteCargoLine {
  const hasDims = !!(line.length || line.width || line.height)
  return {
    ...line,
    ...(Number(line.total_cbm) > 0 && hasDims ? { length: '', width: '', height: '' } : {}),
    ...(Number(line.total_weight) > 0 && line.per_package_weight ? { per_package_weight: '' } : {}),
  }
}

export function needsCleaning(line: QuoteCargoLine | undefined): boolean {
  if (!line) return false
  const c = cleanTotalLine(line)
  return c.length !== line.length || c.per_package_weight !== line.per_package_weight
}

export function hasCargo(lines: QuoteCargoLine[], mode: 'air' | 'sea'): boolean {
  return lines.some((l) => {
    const c = computeCargoLine(l, mode)
    return c.grossTotal > 0 || c.totalCbm > 0 || (Number(l.quantity) || 0) > 0
  })
}

export type CargoSums = { lines: number; pieces: number; kg: number; cbm: number }

export function sumLines(lines: QuoteCargoLine[], mode: 'air' | 'sea'): CargoSums {
  let pieces = 0, kg = 0, cbm = 0, n = 0
  for (const l of lines) {
    const c = computeCargoLine(l, mode)
    const q = Number(l.quantity) || Number(l.packages) || 0
    if (!q && !c.grossTotal && !c.totalCbm) continue
    n += 1; pieces += q; kg += c.grossTotal; cbm += c.totalCbm
  }
  return { lines: n, pieces, kg: r2(kg), cbm: r4(cbm) }
}

/** Individual -> Total: all lines become one line holding the sums, in KG. */
export function toTotal(lines: QuoteCargoLine[], mode: 'air' | 'sea'): QuoteCargoLine[] {
  const s = sumLines(lines, mode)
  const first = lines[0] ?? newQuoteCargoLine(0)
  const descs = [...new Set(lines.map((l) => l.cargo_description.trim()).filter(Boolean))]
  return [{
    ...newQuoteCargoLine(0),
    id: first.id,
    package_type: first.package_type,
    cargo_description: descs.length <= 2 ? descs.join(' / ') : descs[0],
    quantity: s.pieces ? String(s.pieces) : '',
    weight_unit: 'KG',
    total_weight: s.kg ? String(s.kg) : '',
    total_cbm: s.cbm ? String(s.cbm) : '',
  }]
}

/** Total -> Individual: the totals become line 1, split per piece. Totals are kept exactly. */
export function toIndividual(lines: QuoteCargoLine[], mode: 'air' | 'sea'): QuoteCargoLine[] {
  const line = cleanTotalLine(lines[0] ?? newQuoteCargoLine(0))
  const c = computeCargoLine(line, mode)
  const q = Number(line.quantity) || Number(line.packages) || 0
  return [{
    ...line,
    length: '', width: '', height: '',
    per_package_weight: q > 0 && c.enteredTotal > 0 ? String(r2(c.enteredTotal / q)) : '',
    total_weight: c.enteredTotal ? String(c.enteredTotal) : line.total_weight,
    total_cbm: c.totalCbm ? String(c.totalCbm) : '',
  }]
}

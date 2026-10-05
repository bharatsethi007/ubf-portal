import { computeCargoLine, type QuoteCargoLine } from './quoteCargoApi'
import type { QuoteContainer } from './quoteContainersApi'

/** Quantities from the quote request, used to fill Qty by unit. */
export type UnitQty = { kg: number; cbm: number; wm: number; c20: number; c40: number; c40hc: number; total: number; teu: number }

const r3 = (n: number) => Math.round(n * 1000) / 1000

export function buildUnitQty(cargo: QuoteCargoLine[], containers: QuoteContainer[], isAir: boolean): UnitQty {
  let kg = 0, gross = 0, cbm = 0
  for (const cl of cargo) {
    const a = computeCargoLine(cl, 'air')
    const s = computeCargoLine(cl, 'sea')
    kg += isAir ? (cl.override_chargeable ? Number(cl.chargeable_wt) || 0 : a.chargeable) : a.grossTotal
    gross += s.grossTotal
    cbm += s.totalCbm
  }
  const n = (pred: (s: string) => boolean) => containers.reduce((t, c) => t + (pred(String(c.container_size)) ? c.qty || 0 : 0), 0)
  const c20 = n((s) => s.startsWith('20')), c40 = n((s) => s === '40'), c40hc = n((s) => s === '40HC')
  return {
    kg: Math.round(kg * 100) / 100, cbm: r3(cbm), wm: r3(Math.max(cbm, gross / 1000)),
    c20, c40, c40hc, total: c20 + c40 + c40hc, teu: c20 + 2 * (c40 + c40hc),
  }
}

const ONE = new Set(['perbl', 'pershipment', 'perawb', 'perclearance', 'flat', 'perhbl', 'permbl'])

/** Qty for a unit (code or legacy label, e.g. 'per_wm' / 'Per W/M'). Null when the quote has no figure for it. */
export function qtyForUnit(unit: string, q: UnitQty | undefined): string | null {
  const k = (unit || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!k) return null
  if (ONE.has(k)) return '1'
  if (!q) return null
  const v: Record<string, number> = {
    perkg: q.kg, percbm: q.cbm, perwm: q.wm, per20: q.c20, per40: q.c40, per40hc: q.c40hc,
    percontainer: q.total, perteu: q.teu,
  }
  const x = v[k]
  return x && x > 0 ? String(x) : null
}

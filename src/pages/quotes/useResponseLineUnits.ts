import { useMemo } from 'react'
import type { ChargeCode, ChargeUnit } from '../../hooks/useQuoteRefData'
import type { QuoteResponseLine } from './quoteResponseLinesApi'

type Opt = { value: string; label: string }

/**
 * Unit options for quote response lines, limited to the quote's mode (no Per 20' on air),
 * plus the charge-code default unit lookup used when a known charge is picked.
 */
export function useResponseLineUnits(
  units: ChargeUnit[], chargeCodes: ChargeCode[], mode: 'air' | 'sea' | undefined, perKgQty: number | undefined,
) {
  const unitOptions = useMemo<Opt[]>(
    () => units.filter((u) => !mode || u.modes.includes(mode)).map((u) => ({ value: u.code, label: u.label })),
    [units, mode],
  )
  const unitByDesc = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of chargeCodes) if (c.default_unit) m.set(c.description.toLowerCase(), c.default_unit)
    return m
  }, [chargeCodes])

  const unitAllowed = (code: string | null): code is string => !!code && unitOptions.some((o) => o.value === code)

  /** Keep a line's existing unit visible even if it isn't valid for this mode (or is a legacy label). */
  const unitOptionsFor = (unit: string): Opt[] => {
    if (!unit || unitOptions.some((o) => o.value === unit)) return unitOptions
    const known = units.find((u) => u.code === unit)
    return [...unitOptions, { value: unit, label: known ? `${known.label} (not for ${mode})` : unit }]
  }

  /** Unit + qty patch for a unit choice: per KG pulls the chargeable weight. */
  const unitPatch = (u: string): Partial<QuoteResponseLine> => {
    const p: Partial<QuoteResponseLine> = { unit: u }
    if (u === 'per_kg' && perKgQty && perKgQty > 0) p.qty = String(perKgQty)
    return p
  }

  /** Patch for a picked charge description: its default unit when valid for this mode. */
  const defaultUnitPatch = (description: string): Partial<QuoteResponseLine> => {
    const du = unitByDesc.get(description.toLowerCase()) ?? null
    return unitAllowed(du) ? unitPatch(du) : {}
  }

  return { unitOptionsFor, unitPatch, defaultUnitPatch }
}

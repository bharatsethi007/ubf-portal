import { useEffect, useRef, useState } from 'react'
import { suggestCartage, type CartageInput, type CartageSuggestion } from './cartageSuggest'

/** Prices the missing NZ cartage leg. Re-runs only when an input that changes the price changes. */
export function useCartageSuggest(input: CartageInput | null): CartageSuggestion | null {
  const [s, setS] = useState<CartageSuggestion | null>(null)
  const req = useRef(0)
  const key = input ? JSON.stringify({
    k: input.kind, f: input.from, t: input.to, mv: input.facts.movement_type, b: input.legBilled,
    pu: [input.facts.pickup_postal_code, input.facts.pickup_location, input.facts.pickup_address],
    dr: [input.facts.drop_postal_code, input.facts.drop_location, input.facts.drop_address],
    kg: input.kg, cbm: input.cbm, fcl: input.fcl,
    lines: input.lines.map((l) => `${l.charge_group}|${l.description}`),
  }) : ''
  useEffect(() => {
    if (!input) { setS(null); return }
    const id = ++req.current
    const t = window.setTimeout(() => {
      suggestCartage(input).then((r) => { if (id === req.current) setS(r) }).catch(() => { if (id === req.current) setS(null) })
    }, 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return s
}

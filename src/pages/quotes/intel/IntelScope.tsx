import { useEffect, useState } from 'react'
import type { LegView } from './quoteChecks'

/** Origin → Freight → Destination: who pays, what we bill, lines on the option per leg. */
export default function IntelScope({ incoterm, movement, legs }: { incoterm: string | null; movement: string | null; legs: LegView[] }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { setDrawn(false); const t = window.setTimeout(() => setDrawn(true), 80); return () => window.clearTimeout(t) }, [incoterm, movement])
  if (!legs.some((l) => l.payer)) return null
  return (
    <div className="fi-sec" style={{ animationDelay: '.08s' }}>
      <div className="fi-label">Scope<span className="fi-label__aside">{`${(incoterm ?? '').toUpperCase()} ${movement ?? ''}`.trim()}</span></div>
      <div className="fi-legs">
        <span className="fi-legs__rail"><span className="fi-legs__rail-fill" style={{ width: drawn ? '100%' : '0%' }} /></span>
        {legs.map((l, i) => (
          <div key={l.key} className="fi-leg" style={{ animationDelay: `${0.12 + i * 0.12}s` }}>
            <span className={`fi-leg__node${l.billed && drawn ? ' fi-leg__node--on' : ''}`} style={{ transitionDelay: `${0.2 + i * 0.15}s` }}>
              {l.lines > 0 ? l.lines : ''}
            </span>
            <span className="fi-leg__name">{l.label}</span>
            <span className="fi-leg__who">{l.payer ?? '-'} pays</span>
            <span className={`fi-leg__bill${l.billed ? ' fi-leg__bill--on' : ''}`}>{l.billed ? 'We bill' : 'Not ours'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

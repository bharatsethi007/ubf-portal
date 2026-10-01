import { useMemo, useState, type ReactNode } from 'react'
import type { AirRateOption } from './airRateSearchApi'

// Product filter over air results: All (general cargo) · UBF Consol · Airline direct · Personal effects.
// Personal effects only shows on its own tab (it is a separate commodity, not general cargo).

type Tab = 'all' | 'consol' | 'direct' | 'personal_effects'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'consol', label: 'UBF Consol' },
  { key: 'direct', label: 'Airline direct' },
  { key: 'personal_effects', label: 'Personal effects' },
]

function matches(o: AirRateOption, t: Tab): boolean {
  if (t === 'all') return o.airProduct !== 'personal_effects'
  return o.airProduct === t
}

type Props = { options: AirRateOption[]; render: (o: AirRateOption) => ReactNode }

export default function AirOptionsList({ options, render }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, options.filter((o) => matches(o, t.key)).length])) as Record<Tab, number>, [options])
  const hasOwn = counts.consol > 0 || counts.personal_effects > 0
  const shown = hasOwn ? options.filter((o) => matches(o, tab)) : options

  return (
    <>
      {hasOwn && (
        <div className="quotes-tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {TABS.filter((t) => t.key === 'all' || counts[t.key] > 0).map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`quotes-tabs__btn${tab === t.key ? ' quotes-tabs__btn--on' : ''}`}>
              {t.label} <span className="text-muted-foreground" style={{ fontSize: 11 }}>{counts[t.key]}</span>
            </button>
          ))}
        </div>
      )}
      {shown.length === 0
        ? <div className="text-muted-foreground" style={{ fontSize: 12, padding: '8px 0' }}>No options in this view.</div>
        : shown.map((o) => render(o))}
    </>
  )
}

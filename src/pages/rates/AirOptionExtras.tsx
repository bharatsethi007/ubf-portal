import { CalendarClock, Info } from 'lucide-react'
import type { AirRateOption } from './airRateSearchApi'
import { fmtDeparture, productLabel } from './airConsol'
import { fmtMoney } from './fx'

// Small header bits + "possible extras" block for UBF consol / PE options.

export function AirProductBadge({ option: o }: { option: AirRateOption }) {
  if (o.airProduct === 'direct') return null
  const pe = o.airProduct === 'personal_effects'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: pe ? '#F3E8FF' : '#0A2472', color: pe ? '#6B21A8' : '#fff' }}>
      {productLabel(o.airProduct)}
    </span>
  )
}

export function AirDepartureChip({ option: o }: { option: AirRateOption }) {
  if (!o.nextDeparture) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#0A2472' }}>
      <CalendarClock size={13} /> {fmtDeparture(o.nextDeparture)}
    </span>
  )
}

export function AirPossibleExtras({ option: o }: { option: AirRateOption }) {
  if (o.possibleCharges.length === 0) return null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0A2472', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Info size={13} /> Possible extras
        <span className="text-muted-foreground" style={{ fontSize: 11, fontWeight: 400 }}>only if they apply · not in total</span>
      </div>
      {o.possibleCharges.map((c, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: '1px solid #eef2f6', fontSize: 12 }}>
          <span>
            {c.label}
            {c.condition ? <span className="text-muted-foreground" style={{ fontSize: 11 }}> · {c.condition}</span> : null}
          </span>
          <span className="text-muted-foreground" style={{ whiteSpace: 'nowrap' }}>{fmtMoney(c.sellAmount, c.sellCurrency || o.currency || 'NZD')}</span>
        </div>
      ))}
    </div>
  )
}

import { useMemo } from 'react'

export type CourierCourierOption = {
  carrier: string
  service: string
  charge: number
  eta?: string
}

function fmtCharge(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CourierCourierSelector({ options, value, onChange }: {
  options: CourierCourierOption[]
  value: number
  onChange: (index: number) => void
}) {
  const sorted = useMemo(
    () => [...options].sort((a, b) => a.charge - b.charge),
    [options],
  )

  return (
    <div className="card quotes-page__card" style={{ padding: 14, marginTop: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map((o, i) => (
          <label
            key={`${o.carrier}-${o.service}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              borderRadius: 8,
              cursor: 'pointer',
              background: value === i ? '#EEF2FF' : 'transparent',
              border: '1px solid ' + (value === i ? '#2563eb' : 'var(--color-line)'),
            }}
          >
            <input type="radio" checked={value === i} onChange={() => onChange(i)} />
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#0A2472', color: '#fff', whiteSpace: 'nowrap' }}>
              {o.carrier}
            </span>
            <span style={{ fontSize: 13 }}>
              {o.service}
              {o.eta ? ` · ${o.eta}` : ''}
            </span>
            <strong style={{ marginLeft: 'auto', fontSize: 14 }}>NZD {fmtCharge(o.charge)}</strong>
          </label>
        ))}
      </div>
    </div>
  )
}

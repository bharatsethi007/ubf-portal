import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export type CourierCourierOption = {
  carrier: string
  service: string
  charge: number
  currency?: string
  eta?: string
}

type Props = {
  options: CourierCourierOption[]
  value: number
  onChange: (index: number) => void
}

const LOGOS: Record<string, string> = {
  DHL: '/couriers/dhl.png',
  FEDEX: '/couriers/fedex.png',
}

function CarrierBadge({ carrier }: { carrier: string }) {
  const c = carrier.toUpperCase()
  const [broken, setBroken] = useState(false)
  const logo = LOGOS[c]

  if (logo && !broken) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 68, flexShrink: 0 }}>
        <img
          src={logo}
          alt={carrier}
          onError={() => setBroken(true)}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 56, height: 24, padding: '0 8px', background: '#0A2472', color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: 4, flexShrink: 0 }}>
      {carrier}
    </span>
  )
}

function fmtEta(eta?: string): string | null {
  if (!eta) return null
  const d = new Date(eta)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return eta
}

function fmtMoney(n: number, currency = 'NZD'): string {
  const amount = new Intl.NumberFormat('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  return `${currency} ${amount}`
}

function Row({ o, selected, onClick }: { o: CourierCourierOption; selected: boolean; onClick: () => void }) {
  const eta = fmtEta(o.eta)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        borderRadius: 10,
        border: `1px solid ${selected ? '#2563eb' : '#e5e7eb'}`,
        background: selected ? '#eff6ff' : '#fff',
        boxShadow: selected ? '0 0 0 1px #2563eb inset' : 'none',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 16, height: 16, flexShrink: 0, borderRadius: '50%',
          border: `2px solid ${selected ? '#2563eb' : '#cbd5e1'}`,
          background: selected ? '#2563eb' : '#fff',
          boxShadow: selected ? 'inset 0 0 0 3px #fff' : 'none',
        }}
      />
      <CarrierBadge carrier={o.carrier} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {o.service}
        </span>
        {eta && <span style={{ fontSize: 12, color: '#64748b' }}>Est. delivery {eta}</span>}
      </span>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap' }}>
        {fmtMoney(o.charge, o.currency)}
      </span>
    </button>
  )
}

export default function CourierCourierSelector({ options, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (!options.length) return null

  const rest = options.length - 1
  const showAll = expanded || value !== 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      {(showAll ? options : options.slice(0, 1)).map((o, i) => (
        <Row key={`${o.carrier}-${o.service}-${i}`} o={o} selected={i === value} onClick={() => onChange(i)} />
      ))}

      {!showAll && rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            alignSelf: 'center', padding: '6px 12px', border: 'none', background: 'transparent',
            color: '#2563eb', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Show {rest} more option{rest > 1 ? 's' : ''}
          <ChevronDown size={15} />
        </button>
      )}
    </div>
  )
}




import { Link } from 'react-router-dom'
import { ArrowLeftRight, Coins, ListOrdered, Percent, Ruler, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type ActiveSection = {
  icon: LucideIcon
  title: string
  description: string
  to: string
}

type ComingSection = {
  icon: LucideIcon
  title: string
}

const ACTIVE: ActiveSection[] = [
  {
    icon: ListOrdered,
    title: 'Charge codes',
    description: 'Charge codes and groups for quote pricing lines',
    to: '/setup/charge-codes',
  },
  {
    icon: ArrowLeftRight,
    title: 'Exchange rates',
    description: 'Daily FX rates and margins for buy/sell pricing',
    to: '/setup/exchange-rates',
  },
]

const COMING: ComingSection[] = [
  { icon: Coins, title: 'Currencies' },
  { icon: Ruler, title: 'Units' },
  { icon: Percent, title: 'Tax codes' },
  { icon: Scale, title: 'Incoterms' },
]

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 12,
} as const

function ActiveCard({ icon: Icon, title, description, to }: ActiveSection) {
  return (
    <Link to={to} className="card" style={{ padding: '16px 18px', textDecoration: 'none', color: 'inherit' }}>
      <Icon size={22} strokeWidth={1.8} style={{ color: '#0A2472' }} />
      <h2 style={{ margin: '10px 0 4px', fontSize: 15, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
        {description}
      </p>
    </Link>
  )
}

function InertTile({ icon: Icon, title }: ComingSection) {
  return (
    <div
      className="card"
      style={{ padding: '16px 18px', cursor: 'default', opacity: 0.55 }}
    >
      <Icon size={22} strokeWidth={1.8} style={{ color: '#0A2472' }} />
      <h2 style={{ margin: '10px 0 0', fontSize: 15, fontWeight: 600 }}>{title}</h2>
    </div>
  )
}

export default function SetupPage() {
  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <h1>Setup</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Editable reference data used across the portal.
          </p>
        </header>

        <div style={{ ...gridStyle, marginTop: 8 }}>
          {ACTIVE.map((section) => (
            <ActiveCard key={section.to} {...section} />
          ))}
        </div>

        <p style={{ margin: '20px 0 8px', fontSize: 13, color: 'var(--muted-foreground)' }}>
          More coming soon
        </p>
        <div style={gridStyle}>
          {COMING.map((section) => (
            <InertTile key={section.title} {...section} />
          ))}
        </div>
      </div>
    </div>
  )
}

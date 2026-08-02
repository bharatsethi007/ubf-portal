import { Link } from 'react-router-dom'
import { ArrowRight, DollarSign, Anchor, SlidersHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './ratesHub.css'

type ModuleLink = { label: string; to: string }
type ModuleGroup = { icon: LucideIcon; title: string; links: ModuleLink[] }

const GROUPS: ModuleGroup[] = [
  {
    icon: DollarSign,
    title: 'Freight Rates',
    links: [
      { label: 'Sea FCL Charges', to: '/setup/rates/fcl' },
      { label: 'Sea LCL Charges', to: '/setup/rates/lcl' },
      { label: 'Air Charges', to: '/setup/rates/air' },
    ],
  },
  {
    icon: Anchor,
    title: 'Local / Port Charges',
    links: [
      { label: 'Sea FCL Local/Port Charges', to: '/setup/rates/fcl-local' },
      { label: 'Sea LCL Local/Port Charges', to: '/setup/rates/lcl-local' },
      { label: 'Air Local/Port Charges', to: '/setup/rates/air-local' },
    ],
  },
  {
    icon: SlidersHorizontal,
    title: 'Rate Setup',
    links: [
      { label: 'Rules', to: '/setup/rates/rules' },
      { label: 'Ports & Groups', to: '/setup/rates/ports' },
    ],
  },
]

export default function RatesPage() {
  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <h1>Rates</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Manage freight rates, local/port charges, and rate-engine setup across FCL, LCL, and Air.
          </p>
        </header>

        <div className="rates-hub">
          {GROUPS.map((group) => (
            <section key={group.title} className="rates-hub__group">
              <div className="rates-hub__group-head">
                <group.icon size={18} strokeWidth={1.8} />
                <h2>{group.title}</h2>
              </div>
              <ul className="rates-hub__list">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="rates-hub__link">
                      <span>{link.label}</span>
                      <ArrowRight size={16} strokeWidth={1.8} className="rates-hub__arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

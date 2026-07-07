import { NavLink } from 'react-router-dom'
import {
  Bell, ClipboardList, FileText, LayoutGrid, Receipt, RefreshCw, Search, Ship,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import PortalNavLogo from './PortalNavLogo'

const TABS: { to: string; label: string; end?: boolean; icon: LucideIcon }[] = [
  { to: '/portal', label: 'Dashboard', end: true, icon: LayoutGrid },
  { to: '/portal/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/portal/shipments', label: 'Shipments', icon: Ship },
  { to: '/portal/quotes', label: 'Quotes', icon: FileText },
  { to: '/portal/billing', label: 'Billing', icon: Receipt },
]

type Props = { displayName: string; initials: string; onRefresh?: () => void }

export default function PortalNav({ initials, onRefresh }: Props) {
  return (
    <header className="portal-nav">
      <NavLink to="/portal" className="portal-nav__brand">
        <PortalNavLogo />
      </NavLink>

      <nav className="portal-nav__tabs" aria-label="Customer portal">
        {TABS.map(({ to, label, end, icon: Icon }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `portal-navbtn${isActive ? ' portal-navbtn--on' : ''}`}>
            <Icon size={16} className="portal-navbtn__icon" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="portal-nav__tools">
        <button type="button" className="portal-navbtn" aria-label="Search" style={{ padding: 8 }}>
          <Search size={18} />
        </button>
        <button type="button" className="portal-navbtn" aria-label="Refresh" style={{ padding: 8 }}
          onClick={onRefresh}>
          <RefreshCw size={18} />
        </button>
        <button type="button" className="portal-navbtn" aria-label="Notifications" style={{ padding: 8 }}>
          <Bell size={18} />
        </button>
        <div className="portal-nav__user">
          <span>Customer portal ▾</span>
          <span className="portal-avatar" aria-hidden>{initials}</span>
        </div>
      </div>
    </header>
  )
}

import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Bell, ChevronDown, ClipboardList, FileText, LayoutGrid, LogOut, Receipt, RefreshCw, Search, Ship,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { portalSignOut } from '../auth/portalSignOut'
import PortalNavLogo from './PortalNavLogo'

const TABS: { to: string; label: string; end?: boolean; icon: LucideIcon }[] = [
  { to: '/portal', label: 'Dashboard', end: true, icon: LayoutGrid },
  { to: '/portal/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/portal/shipments', label: 'Shipments', icon: Ship },
  { to: '/portal/quotes', label: 'Quotes', icon: FileText },
  { to: '/portal/billing', label: 'Billing', icon: Receipt },
]

type Props = {
  displayName: string
  userEmail: string
  initials: string
  onRefresh?: () => void
}

export default function PortalNav({ displayName, userEmail, initials, onRefresh }: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    await portalSignOut()
    navigate('/portal/login', { replace: true })
  }

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
        <div className="portal-nav__user-menu" ref={menuRef}>
          <button type="button" className="portal-nav__user" aria-expanded={menuOpen} aria-haspopup="true"
            onClick={() => setMenuOpen((v) => !v)}>
            <span className="portal-nav__user-label">{displayName}</span>
            <span className="portal-avatar" aria-hidden>{initials}</span>
            <ChevronDown size={14} className={`portal-nav__chevron${menuOpen ? ' portal-nav__chevron--open' : ''}`} />
          </button>
          {menuOpen && (
            <div className="portal-nav__dropdown">
              <span className="portal-nav__dropdown-email">{userEmail}</span>
              <button type="button" className="portal-nav__dropdown-item" onClick={handleLogout}>
                <LogOut size={15} aria-hidden />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

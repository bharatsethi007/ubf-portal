import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, MessageCircle, Search } from 'lucide-react'
import { portalSignOut } from '../auth/portalSignOut'

const TABS = [
  { to: '/portal', label: 'Home', end: true },
  { to: '/portal/shipments', label: 'Shipments' },
  { to: '/portal/billing', label: 'Billing' },
  { to: '/portal/quotes', label: 'Quotes' },
]

type Props = {
  displayName: string
  userEmail: string
  initials: string
  onSearch: () => void
}

export default function PortalTopBar({ displayName, userEmail, initials, onSearch }: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  async function logout() {
    setMenuOpen(false)
    await portalSignOut()
    navigate('/portal/login', { replace: true })
  }

  return (
    <header className="pv2-top">
      <NavLink to="/portal" className="pv2-top__brand" aria-label="UB Freight home">
        <img src="/ub-freight-logo-white.png" alt="UB Freight" height={28} />
      </NavLink>

      <nav className="pv2-top__nav" aria-label="Customer portal">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `pv2-top__tab${isActive ? ' pv2-top__tab--on' : ''}`}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <button type="button" className="pv2-top__search" onClick={onSearch}>
        <Search size={16} aria-hidden />
        <span>Search anything</span>
        <kbd className="pv2-kbd pv2-kbd--dark">Ctrl K</kbd>
      </button>
      <button type="button" className="pv2-top__icon pv2-top__icon--mobile" aria-label="Search" onClick={onSearch}>
        <Search size={18} />
      </button>

      <NavLink to="/portal/settings/whatsapp" className="pv2-top__icon" aria-label="WhatsApp updates">
        <MessageCircle size={18} />
      </NavLink>
      <button type="button" className="pv2-top__icon" aria-label="Notifications">
        <Bell size={18} />
      </button>

      <div className="pv2-top__user" ref={menuRef}>
        <button type="button" className="pv2-top__userbtn" aria-expanded={menuOpen} aria-haspopup="true"
          onClick={() => setMenuOpen((v) => !v)}>
          <span className="pv2-avatar">{initials}</span>
          <span className="pv2-top__username">{displayName}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
        {menuOpen && (
          <div className="pv2-menu">
            <span className="pv2-menu__email">{userEmail}</span>
            <NavLink to="/portal/settings/whatsapp" className="pv2-menu__item" onClick={() => setMenuOpen(false)}>
              <MessageCircle size={15} aria-hidden /> WhatsApp updates
            </NavLink>
            <button type="button" className="pv2-menu__item" onClick={logout}>
              <LogOut size={15} aria-hidden /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

import { useEffect, useRef, useState } from 'react'
import { unreadTotal } from './messages/messagesApi'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, LogOut, MessageCircle, Search, Users } from 'lucide-react'
import NotificationBell from './notifications/NotificationBell'
import { portalSignOut } from '../auth/portalSignOut'

const TABS = [
  { to: '/portal', label: 'Home', end: true },
  { to: '/portal/shipments', label: 'Shipments' },
  { to: '/portal/bookings', label: 'Bookings' },
  { to: '/portal/products', label: 'Products' },
  { to: '/portal/analytics', label: 'Analytics' },
  { to: '/portal/billing', label: 'Billing' },
  { to: '/portal/rates', label: 'Rates' },
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
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void unreadTotal().then(setUnread) }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

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

      <NavLink to="/portal/messages" className="pv2-top__icon pv3-bell__btn" aria-label={unread ? `Messages, ${unread} unread` : 'Messages'} title="Messages">
        <MessageCircle size={18} />
        {unread > 0 && <span className="pv3-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </NavLink>
      <NotificationBell />

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
            <NavLink to="/portal/settings/team" className="pv2-menu__item" onClick={() => setMenuOpen(false)}>
              <Users size={15} aria-hidden /> Team
            </NavLink>
            <NavLink to="/portal/settings/notifications" className="pv2-menu__item" onClick={() => setMenuOpen(false)}>
              <Bell size={15} aria-hidden /> Notifications
            </NavLink>
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

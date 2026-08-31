import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import {
  BarChart3, Building2, Calendar, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardList,
  FileText, Handshake, Menu, MessageCircle, Package, Plane, Search, Settings, Ship,
  TowerControl, Truck, User, Users, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Logo from '../components/Logo'
import SyncButton from '../components/SyncButton'
import { needsActionTotal } from '../pages/whatsapp/whatsappInboxApi'
import { supabase } from '../supabase'
import { ModuleGuard, usePermissions } from '../access/PermissionsProvider'

const ORANGE = '#F7941D'
const COLLAPSE_KEY = 'ubf.sidebar.collapsed'

const NAV = [
  { to: '/', label: 'Control Tower', icon: TowerControl, end: true, module: 'control_tower' },
  { to: '/quotes', label: 'Quotes', icon: FileText, module: 'quotes' },
  { to: '/shipments', label: 'Shipments', icon: Package, module: 'shipments' },
  { to: '/tms', label: 'TMS', icon: Truck, module: 'tms' },
]
const NAV2 = [
  { to: '/customers', label: 'Customers', icon: Building2, module: 'customers' },
  { to: '/agents', label: 'Agents', icon: Handshake, module: 'agents' },
  { to: '/schedules', label: 'Schedules', icon: Calendar, module: 'schedules' },
  { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
  { to: '/users', label: 'Users', icon: Users, module: 'users' },
  { to: '/setup', label: 'Setup', icon: Settings, module: 'setup' },
]
const BOOKINGS = [
  { to: '/bookings/EA', label: 'Export Air', icon: Plane },
  { to: '/bookings/ES', label: 'Export Sea', icon: Ship },
  { to: '/bookings/IA', label: 'Import Air', icon: Plane },
  { to: '/bookings/IS', label: 'Import Sea', icon: Ship },
  { to: '/bookings/import-sea', label: 'Import Sea board', icon: Ship },
]

const linkBase: React.CSSProperties = {
  position: 'relative', display: 'flex', alignItems: 'center', gap: 11,
  padding: '9px 12px', borderRadius: 10, fontSize: 13.5, fontWeight: 400,
  color: 'rgba(255,255,255,.6)', textDecoration: 'none', cursor: 'pointer',
  border: 'none', background: 'transparent', width: '100%', textAlign: 'left',
}
const onPill: React.CSSProperties = { color: '#fff', fontWeight: 500, background: 'rgba(255,255,255,.12)' }
const orangeBar: React.CSSProperties = { position: 'absolute', left: -8, top: 9, bottom: 9, width: 3, borderRadius: 3, background: ORANGE }
const collapsedLink: React.CSSProperties = { justifyContent: 'center', gap: 0, padding: '10px 0' }
const ActiveBar = ({ on }: { on: boolean }) => (on ? <span style={orangeBar} /> : null)

type Props = { session: Session; staffName: string; search: string; onSearch: (q: string) => void }

export default function AppShell({ session, staffName, search, onSearch }: Props) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [bkOpen, setBkOpen] = useState(true)
  const [waNeedsAction, setWaNeedsAction] = useState(0)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 901px)').matches : true)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const bkActive = location.pathname.startsWith('/bookings')
  const shrink = collapsed && isDesktop

  const { perms, loading: permsLoading } = usePermissions()
  // Optimistic during load (show all), then filter to modules the user can read.
  const canRead = (m: string) => (permsLoading ? true : (perms[m]?.read ?? false))

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => { setNavOpen(false) }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void needsActionTotal()
        .then((n) => { if (!cancelled) setWaNeedsAction(n) })
        .catch(() => { if (!cancelled) setWaNeedsAction(0) })
    }
    load()
    const id = window.setInterval(load, 60_000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  const navStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => {
    const base = shrink ? { ...linkBase, ...collapsedLink } : linkBase
    return isActive ? { ...base, ...onPill } : base
  }
  const bkBtnStyle: React.CSSProperties = shrink
    ? { ...linkBase, ...collapsedLink, ...(bkActive ? onPill : {}) }
    : (bkActive ? { ...linkBase, ...onPill } : linkBase)

  function onBookingsClick() {
    if (shrink) { setCollapsed(false); setBkOpen(true) }
    else setBkOpen((o) => !o)
  }

  const nav1 = NAV.filter((n) => canRead(n.module))
  const nav2 = NAV2.filter((n) => canRead(n.module))
  const showBookings = canRead('bookings')

  return (
    <div className={`shell${shrink ? ' shell--nav-collapsed' : ''}`}>
      {navOpen && <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setNavOpen(false)} />}

      <aside
        className={`sidebar${navOpen ? ' sidebar--open' : ''}`}
        style={{
          background: 'linear-gradient(180deg, #0A2472 0%, #06143B 100%)',
          backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          border: '1px solid rgba(255,255,255,.08)', borderRight: '1px solid rgba(255,255,255,.08)',
          margin: 12, borderRadius: 20, alignSelf: 'flex-start',
          height: 'calc(100vh - 24px)', overflow: 'hidden auto',
          boxShadow: '0 18px 48px rgba(6,16,50,.38)',
          display: 'flex', flexDirection: 'column', padding: shrink ? '16px 8px' : 16,
        }}
      >
        <div className="sidebar__head" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, minHeight: 40 }}>
          <Logo />
          <button type="button" className="sidebar-close" aria-label="Close navigation" onClick={() => setNavOpen(false)} style={{ position: 'absolute', right: 0, top: 0 }}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: shrink ? '0' : '0 6px' }}>
          {nav1.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={navStyle} title={shrink ? label : undefined} onClick={() => setNavOpen(false)}>
              {({ isActive }) => (<><ActiveBar on={isActive} /><Icon size={18} strokeWidth={1.8} />{!shrink && label}</>)}
            </NavLink>
          ))}

          {showBookings && (
            <button type="button" onClick={onBookingsClick} title={shrink ? 'Bookings' : undefined} style={bkBtnStyle}>
              <ActiveBar on={bkActive} />
              <ClipboardList size={18} strokeWidth={1.8} />
              {!shrink && <span style={{ flex: 1 }}>Bookings</span>}
              {!shrink && <ChevronDown size={15} style={{ transition: '.15s', transform: bkOpen ? 'rotate(180deg)' : 'none' }} />}
            </button>
          )}
          {showBookings && !shrink && bkOpen && BOOKINGS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setNavOpen(false)}
              style={({ isActive }) => isActive ? { ...linkBase, ...onPill, paddingLeft: 38, fontSize: 12.5 } : { ...linkBase, paddingLeft: 38, fontSize: 12.5 }}>
              <Icon size={15} strokeWidth={1.8} />{label}
            </NavLink>
          ))}

          {nav2.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} style={navStyle} title={shrink ? label : undefined} onClick={() => setNavOpen(false)}>
              {({ isActive }) => (<><ActiveBar on={isActive} /><Icon size={18} strokeWidth={1.8} />{!shrink && label}</>)}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={shrink ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={shrink ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {shrink ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="menu-toggle" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="search-wrap">
            <Search size={18} className="search-icon" strokeWidth={2} />
            <input className="input search-input" placeholder="Quick search" value={search} onChange={(e) => onSearch(e.target.value)} aria-label="Quick search" />
          </div>
          <div className="topbar__actions">
            <button
              type="button"
              className="sync-btn wa-topbar-btn"
              title="WhatsApp inbox"
              aria-label="WhatsApp inbox"
              onClick={() => navigate('/whatsapp')}
            >
              <MessageCircle size={16} strokeWidth={2} />
              {waNeedsAction > 0 ? (
                <span className="wa-topbar-btn__badge">{waNeedsAction > 99 ? '99+' : waNeedsAction}</span>
              ) : null}
            </button>
            <SyncButton userEmail={session.user.email ?? ''} />
            <div className="user-menu" ref={menuRef}>
              <button type="button" className="user-btn" aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen((v) => !v)}>
                <span className="user-avatar"><User size={16} strokeWidth={2} /></span>
                <span className="user-name">{staffName}</span>
                <ChevronDown size={16} className={`user-chevron${menuOpen ? ' open' : ''}`} />
              </button>
              {menuOpen && (
                <div className="user-dropdown">
                  <span className="muted user-email">{session.user.email}</span>
                  <button type="button" className="dropdown-item" onClick={() => { setMenuOpen(false); supabase.auth.signOut() }}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content"><ModuleGuard><Outlet /></ModuleGuard></main>
      </div>
    </div>
  )
}

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import {
  BarChart3, Building2, Calendar, ChevronsLeft, ChevronsRight, ClipboardList,
  FileText, Handshake, ListChecks, Menu, MessageCircle, Package, PackageCheck, Search, Settings,
  TowerControl, Truck, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import Logo from '../components/Logo'
import SyncButton from '../components/SyncButton'
import UserMenu from '../components/staff/UserMenu'
import StaffNotificationBell from '../components/staff/notifications/StaffNotificationBell'
import { fetchCounts } from '../pages/inbox/inboxApi'
import { supabase } from '../supabase'
import { ModuleGuard, usePermissions } from '../access/PermissionsProvider'

const ORANGE = '#F7941D'
const COLLAPSE_KEY = 'ubf.sidebar.collapsed'

const NAV = [
  { to: '/', label: 'Control Tower', icon: TowerControl, end: true, module: 'control_tower' },
  { to: '/quotes', label: 'Quotes', icon: FileText, module: 'quotes' },
  { to: '/shipments', label: 'Shipments', icon: Package, module: 'shipments' },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, module: 'bookings' },
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

type Props = { session: Session; search: string; onSearch: (q: string) => void }

export default function AppShell({ session, search, onSearch }: Props) {
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const [inboxAwaiting, setInboxAwaiting] = useState(0)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 901px)').matches : true)
  const location = useLocation()
  const courierActive = location.pathname.startsWith('/bookings/courier')
  const bkActive = location.pathname.startsWith('/bookings') && !courierActive
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

  useEffect(() => { setNavOpen(false) }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void fetchCounts()
        .then((c) => { if (!cancelled) setInboxAwaiting(c?.awaiting ?? 0) })
        .catch(() => { if (!cancelled) setInboxAwaiting(0) })
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
            <NavLink to="/bookings" title={shrink ? 'Bookings' : undefined} style={bkBtnStyle} onClick={() => setNavOpen(false)}>
              <ActiveBar on={bkActive} />
              <ClipboardList size={18} strokeWidth={1.8} />
              {!shrink && 'Bookings'}
            </NavLink>
          )}
          {showBookings && (
            <NavLink to="/bookings/courier" title={shrink ? 'Courier' : undefined} style={() => navStyle({ isActive: courierActive })} onClick={() => setNavOpen(false)}>
              <ActiveBar on={courierActive} />
              <PackageCheck size={18} strokeWidth={1.8} />
              {!shrink && 'Courier'}
            </NavLink>
          )}

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
            <StaffNotificationBell userId={session.user.id} />
            <button type="button" className="sync-btn wa-topbar-btn" title="Inbox" aria-label="Inbox" onClick={() => navigate('/inbox')}>
              <MessageCircle size={16} strokeWidth={2} />
              {inboxAwaiting > 0 ? <span className="wa-topbar-btn__badge">{inboxAwaiting > 99 ? '99+' : inboxAwaiting}</span> : null}
            </button>
            <SyncButton userEmail={session.user.email ?? ''} />
            <UserMenu session={session} />
          </div>
        </header>
        <main className="content"><ModuleGuard><Outlet /></ModuleGuard></main>
      </div>
    </div>
  )
}

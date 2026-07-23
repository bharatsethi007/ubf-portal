import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import {
  BarChart3, Building2, Calendar, ChevronDown, ClipboardList, FileText,
  Menu, Package, Plane, Search, Ship, TowerControl, User, Users, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Logo from '../components/Logo'
import SyncButton from '../components/SyncButton'
import { supabase } from '../supabase'

const ORANGE = '#F7941D'

const NAV = [
  { to: '/', label: 'Control Tower', icon: TowerControl, end: true },
  { to: '/estimates', label: 'Quotes', icon: FileText },
  { to: '/shipments', label: 'Shipments', icon: Package },
]
const NAV2 = [
  { to: '/customers', label: 'Customers', icon: Building2 },
  { to: '/schedules', label: 'Schedules', icon: Calendar },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/users', label: 'Users', icon: Users },
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
const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => isActive ? { ...linkBase, ...onPill } : linkBase
const ActiveBar = ({ on }: { on: boolean }) => (on ? <span style={orangeBar} /> : null)

type Props = { session: Session; staffName: string; search: string; onSearch: (q: string) => void }

export default function AppShell({ session, staffName, search, onSearch }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [bkOpen, setBkOpen] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const bkActive = location.pathname.startsWith('/bookings')

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => { setNavOpen(false) }, [location.pathname])

  return (
    <div className="shell">
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
          display: 'flex', flexDirection: 'column', padding: 16,
        }}
      >
        {/* centered logo (grid placeItems centers regardless of inner margins) */}
        <div className="sidebar__head" style={{ position: 'relative', display: 'grid', placeItems: 'center', marginBottom: 18 }}>
          <Logo />
          <button type="button" className="sidebar-close" aria-label="Close navigation" onClick={() => setNavOpen(false)} style={{ position: 'absolute', right: 0, top: 0 }}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 6px' }}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={navLinkStyle} onClick={() => setNavOpen(false)}>
              {({ isActive }) => (<><ActiveBar on={isActive} /><Icon size={18} strokeWidth={1.8} />{label}</>)}
            </NavLink>
          ))}

          <button type="button" onClick={() => setBkOpen((o) => !o)} style={bkActive ? { ...linkBase, ...onPill } : linkBase}>
            <ActiveBar on={bkActive} />
            <ClipboardList size={18} strokeWidth={1.8} />
            <span style={{ flex: 1 }}>Bookings</span>
            <ChevronDown size={15} style={{ transition: '.15s', transform: bkOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {bkOpen && BOOKINGS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setNavOpen(false)}
              style={({ isActive }) => isActive ? { ...linkBase, ...onPill, paddingLeft: 38, fontSize: 12.5 } : { ...linkBase, paddingLeft: 38, fontSize: 12.5 }}>
              <Icon size={15} strokeWidth={1.8} />{label}
            </NavLink>
          ))}

          {NAV2.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={navLinkStyle} onClick={() => setNavOpen(false)}>
              {({ isActive }) => (<><ActiveBar on={isActive} /><Icon size={18} strokeWidth={1.8} />{label}</>)}
            </NavLink>
          ))}
        </nav>
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
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}

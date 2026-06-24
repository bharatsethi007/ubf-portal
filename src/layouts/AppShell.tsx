import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import {
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Search,
  User,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Logo from '../components/Logo'
import SyncButton from '../components/SyncButton'
import { supabase } from '../supabase'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/estimates', label: 'Estimates & Quotes', icon: FileText },
  { to: '/shipments', label: 'Shipments', icon: Package },
  { to: '/customers', label: 'Customers', icon: Building2 },
  { to: '/schedules', label: 'Schedules', icon: Calendar },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/users', label: 'Users', icon: Users },
]

type Props = {
  session: Session
  staffName: string
  search: string
  onSearch: (q: string) => void
}

export default function AppShell({ session, staffName, search, onSearch }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  return (
    <div className="shell">
      {navOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside className={`sidebar${navOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__head">
          <Logo />
          <button
            type="button"
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <button type="button" className="btn-new" onClick={() => navigate('/new-booking')}>
          <Plus size={18} strokeWidth={2.5} />
          New Booking
        </button>

        <nav className="sidebar__nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="search-wrap">
            <Search size={18} className="search-icon" strokeWidth={2} />
            <input
              className="input search-input"
              placeholder="Quick search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Quick search"
            />
          </div>

          <div className="topbar__actions">
            <SyncButton userEmail={session.user.email ?? ''} />

            <div className="user-menu" ref={menuRef}>
            <button
              type="button"
              className="user-btn"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="user-avatar">
                <User size={16} strokeWidth={2} />
              </span>
              <span className="user-name">{staffName}</span>
              <ChevronDown size={16} className={`user-chevron${menuOpen ? ' open' : ''}`} />
            </button>
            {menuOpen && (
              <div className="user-dropdown">
                <span className="muted user-email">{session.user.email}</span>
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false)
                    supabase.auth.signOut()
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

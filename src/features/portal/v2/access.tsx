import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'

/**
 * Portal module access. Admins get every module. Members get only portal_users.modules.
 * The database enforces this too (portal_account_for / portal_can), so hiding here is UX, not the lock.
 * Home, Shipments, Messages and Settings are core: always on.
 */
export type ModuleKey = 'bookings' | 'rates' | 'products' | 'analytics' | 'billing'

export const MODULES: { key: ModuleKey; label: string; help: string }[] = [
  { key: 'bookings', label: 'Bookings', help: 'Request and edit bookings' },
  { key: 'rates', label: 'Rates & quotes', help: 'Search rates, see and approve quotes' },
  { key: 'products', label: 'Products', help: 'SKUs and purchase orders' },
  { key: 'analytics', label: 'Analytics', help: 'Volumes, lanes, suppliers' },
  { key: 'billing', label: 'Finance & invoices', help: 'Invoices, statements, balances, freight spend' },
]
export const ALL_MODULES: ModuleKey[] = MODULES.map((m) => m.key)

const PATHS: [string, ModuleKey][] = [
  ['/portal/bookings', 'bookings'],
  ['/portal/rates', 'rates'],
  ['/portal/quotes', 'rates'],
  ['/portal/products', 'products'],
  ['/portal/analytics', 'analytics'],
  ['/portal/billing', 'billing'],
]

/** Module a portal path belongs to, or null for core pages. */
export function moduleForPath(path: string): ModuleKey | null {
  const p = path.split(/[?#]/)[0]
  const hit = PATHS.find(([prefix]) => p === prefix || p.startsWith(`${prefix}/`))
  return hit ? hit[1] : null
}

export type Access = { role: 'admin' | 'member'; modules: string[] }
type Ctx = { ready: boolean; can: (m: ModuleKey) => boolean; canPath: (path: string) => boolean }

const AccessCtx = createContext<Ctx>({ ready: false, can: () => false, canPath: () => false })

export function PortalAccessProvider({ access, children }: { access: Access | null; children: ReactNode }) {
  const value = useMemo<Ctx>(() => {
    const can = (m: ModuleKey) => !!access && (access.role === 'admin' || access.modules.includes(m))
    return {
      ready: !!access,
      can,
      canPath: (path: string) => { const m = moduleForPath(path); return m === null || can(m) },
    }
  }, [access])
  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>
}

export const usePortalAccess = () => useContext(AccessCtx)

/** Route guard. Waits for access to load, then shows the page or a no-access note. */
export function RequireModule({ m, children }: { m: ModuleKey; children: ReactNode }) {
  const { ready, can } = usePortalAccess()
  if (!ready) return null
  if (can(m)) return <>{children}</>
  const label = MODULES.find((x) => x.key === m)?.label ?? 'This page'
  return (
    <div className="pv3-page">
      <section className="pv3-card pv3-rise" style={{ padding: 32, textAlign: 'center', maxWidth: 520, margin: '40px auto' }}>
        <Lock size={22} style={{ color: 'var(--muted)' }} />
        <h1 style={{ fontSize: 18, margin: '10px 0 6px' }}>No access to {label}</h1>
        <p className="pv3-muted" style={{ margin: '0 0 16px' }}>Ask an admin at your company to turn it on for you in Team.</p>
        <Link to="/portal" className="pv3-btn pv3-btn--ghost">Back to Home</Link>
      </section>
    </div>
  )
}

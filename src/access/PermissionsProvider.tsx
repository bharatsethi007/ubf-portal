import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

export type ModuleOp = 'read' | 'add' | 'edit' | 'delete'
export type ModulePerm = { read: boolean; add: boolean; edit: boolean; delete: boolean }
type PermMap = Record<string, ModulePerm>

type Ctx = { perms: PermMap; loading: boolean; refresh: () => Promise<void> }
const NONE: ModulePerm = { read: false, add: false, edit: false, delete: false }
const PermissionsContext = createContext<Ctx>({ perms: {}, loading: true, refresh: async () => {} })

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [perms, setPerms] = useState<PermMap>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('my_permissions')
    if (!error && Array.isArray(data)) {
      const map: PermMap = {}
      for (const r of data as Array<Record<string, unknown>>) {
        map[r.module_key as string] = {
          read: !!r.can_read, add: !!r.can_add, edit: !!r.can_edit, delete: !!r.can_delete,
        }
      }
      setPerms(map)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  return (
    <PermissionsContext.Provider value={{ perms, loading, refresh: load }}>
      {children}
    </PermissionsContext.Provider>
  )
}

// Full permission object for a module (all-false if unknown).
export function useModulePerm(module: string): ModulePerm {
  return useContext(PermissionsContext).perms[module] ?? NONE
}
// Single op check.
export function usePerm(module: string, op: ModuleOp): boolean {
  return useModulePerm(module)[op]
}
export function useCanRead(module: string): boolean {
  return useModulePerm(module).read
}
export function usePermsLoading(): boolean {
  return useContext(PermissionsContext).loading
}
export function usePermissions() {
  return useContext(PermissionsContext)
}

// Gate a button/section on a permission.
export function RequirePerm(
  { module, op, children, fallback = null }:
  { module: string; op: ModuleOp; children: ReactNode; fallback?: ReactNode },
) {
  return usePerm(module, op) ? <>{children}</> : <>{fallback}</>
}

// Longest-prefix path to module map. Unmapped paths are not guarded (allowed).
const PATH_MODULE: Array<[string, string]> = [
  ['/setup/rates', 'rates'],
  ['/setup', 'setup'],
  ['/quotes', 'quotes'],
  ['/shipments', 'shipments'],
  ['/tms', 'tms'],
  ['/bookings', 'bookings'],
  ['/customers', 'customers'],
  ['/agents', 'agents'],
  ['/schedules', 'schedules'],
  ['/reports', 'reports'],
  ['/users', 'users'],
]
export function moduleForPath(pathname: string): string | null {
  if (pathname === '/') return 'control_tower'
  const hit = PATH_MODULE.find(([pre]) => pathname === pre || pathname.startsWith(pre + '/'))
  return hit ? hit[1] : null
}

// Wrap the page outlet: blocks the current route if the user lacks read on its module.
export function ModuleGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { perms, loading } = usePermissions()
  const module = moduleForPath(pathname)

  if (loading) return <div className="muted pad">Loading...</div>
  if (module && !(perms[module]?.read ?? false)) {
    return (
      <div className="pad" style={{ maxWidth: 460, margin: '48px auto', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>No access</h2>
        <p className="muted">You do not have permission to view this module. Ask an administrator if you need access.</p>
      </div>
    )
  }
  return <>{children}</>
}

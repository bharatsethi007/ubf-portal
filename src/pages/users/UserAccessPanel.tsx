import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { usePerm } from '../../access/PermissionsProvider'
import {
  assignRole, deleteUserOverride, getUserOverrides, getUserRoleIds, listModules,
  listRoles, unassignRole, upsertUserOverride, type AppModule, type Role,
} from './usersApi'

const NAVY = '#2563EB'
type Tri = '' | 'allow' | 'deny'
type OpKey = 'can_read' | 'can_add' | 'can_edit' | 'can_delete'
type TriRow = { can_read: Tri; can_add: Tri; can_edit: Tri; can_delete: Tri }
const OPS: Array<{ key: OpKey; label: string }> = [
  { key: 'can_read', label: 'Read' }, { key: 'can_add', label: 'Add' },
  { key: 'can_edit', label: 'Edit' }, { key: 'can_delete', label: 'Delete' },
]
const INHERIT: TriRow = { can_read: '', can_add: '', can_edit: '', can_delete: '' }
const toTri = (v: boolean | null): Tri => (v === null ? '' : v ? 'allow' : 'deny')
const fromTri = (t: Tri): boolean | null => (t === '' ? null : t === 'allow')

export default function UserAccessPanel(
  { userId, email, isAdmin, onChanged }:
  { userId: string; email: string | null; isAdmin: boolean; onChanged: () => void },
) {
  const canEdit = usePerm('users', 'edit')
  const [roles, setRoles] = useState<Role[]>([])
  const [modules, setModules] = useState<AppModule[]>([])
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set())
  const [grid, setGrid] = useState<Record<string, TriRow>>({})
  const [initial, setInitial] = useState<Record<string, TriRow>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let c = false
    setLoading(true)
    ;(async () => {
      try {
        const [rs, ms, rids, ovr] = await Promise.all([
          listRoles(), listModules(), getUserRoleIds(userId), getUserOverrides(userId),
        ])
        if (c) return
        setRoles(rs); setModules(ms); setRoleIds(new Set(rids))
        const g: Record<string, TriRow> = {}
        for (const m of ms) g[m.key] = { ...INHERIT }
        for (const o of ovr) {
          g[o.module_key] = { can_read: toTri(o.can_read), can_add: toTri(o.can_add), can_edit: toTri(o.can_edit), can_delete: toTri(o.can_delete) }
        }
        setGrid(g); setInitial(JSON.parse(JSON.stringify(g)) as Record<string, TriRow>)
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load access') }
      finally { if (!c) setLoading(false) }
    })()
    return () => { c = true }
  }, [userId])

  const dirty = useMemo(() => JSON.stringify(grid) !== JSON.stringify(initial), [grid, initial])

  async function toggleRole(roleId: string, on: boolean) {
    if (!canEdit) return
    try {
      if (on) await assignRole(userId, roleId); else await unassignRole(userId, roleId)
      setRoleIds((prev) => { const n = new Set(prev); if (on) n.add(roleId); else n.delete(roleId); return n })
      onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update role') }
  }

  function setCell(moduleKey: string, op: OpKey, val: Tri) {
    setGrid((g) => ({ ...g, [moduleKey]: { ...(g[moduleKey] ?? INHERIT), [op]: val } }))
  }

  async function saveOverrides() {
    setSaving(true)
    try {
      for (const m of modules) {
        const cur = grid[m.key] ?? INHERIT
        const was = initial[m.key] ?? INHERIT
        if (JSON.stringify(cur) === JSON.stringify(was)) continue
        const allInherit = cur.can_read === '' && cur.can_add === '' && cur.can_edit === '' && cur.can_delete === ''
        if (allInherit) await deleteUserOverride(userId, m.key)
        else await upsertUserOverride(userId, m.key, { can_read: fromTri(cur.can_read), can_add: fromTri(cur.can_add), can_edit: fromTri(cur.can_edit), can_delete: fromTri(cur.can_delete) })
      }
      setInitial(JSON.parse(JSON.stringify(grid)) as Record<string, TriRow>)
      toast.success('Overrides saved')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="muted pad">Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>{email ?? 'User'}</h2>
        {isAdmin && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', color: NAVY, background: '#eef1f8', padding: '2px 8px', borderRadius: 999 }}>ADMIN</span>}
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px' }}>Roles</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {roles.map((r) => {
          const on = roleIds.has(r.id)
          return (
            <button key={r.id} type="button" disabled={!canEdit} onClick={() => toggleRole(r.id, !on)}
              style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, cursor: canEdit ? 'pointer' : 'default',
                border: `1px solid ${on ? NAVY : 'var(--line)'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#334155' }}>
              {r.name}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 8px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Overrides</h3>
        {canEdit && (
          <button type="button" onClick={saveOverrides} disabled={!dirty || saving} title="Save overrides"
            style={{ display: 'inline-grid', placeItems: 'center', width: 36, height: 36, borderRadius: 8, border: 'none', background: NAVY, color: '#fff', cursor: dirty && !saving ? 'pointer' : 'default', opacity: dirty && !saving ? 1 : 0.4 }}>
            <Save size={16} />
          </button>
        )}
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Module</th>
              {OPS.map((o) => <th key={o.key} style={{ width: 110, textAlign: 'center' }}>{o.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const row = grid[m.key] ?? INHERIT
              return (
                <tr key={m.key}>
                  <td>{m.label}</td>
                  {OPS.map((o) => (
                    <td key={o.key} style={{ textAlign: 'center' }}>
                      <select className="input input--sm" value={row[o.key]} disabled={!canEdit}
                        onChange={(e) => setCell(m.key, o.key, e.target.value as Tri)} style={{ width: 92, accentColor: NAVY }}>
                        <option value="">Inherit</option>
                        <option value="allow">Allow</option>
                        <option value="deny">Deny</option>
                      </select>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

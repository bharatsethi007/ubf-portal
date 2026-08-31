import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Save, Trash2 } from 'lucide-react'
import { usePerm } from '../../access/PermissionsProvider'
import {
  createRole, deleteRole, getRolePermissions, listModules, listRoles,
  saveRolePermissions, updateRole, type AppModule, type Role, type RolePerm,
} from './usersApi'

const NAVY = '#2563EB'
type Cell = { can_read: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }
type Grid = Record<string, Cell>
const OPS: Array<{ key: keyof Cell; label: string }> = [
  { key: 'can_read', label: 'Read' }, { key: 'can_add', label: 'Add' },
  { key: 'can_edit', label: 'Edit' }, { key: 'can_delete', label: 'Delete' },
]
const OFF: Cell = { can_read: false, can_add: false, can_edit: false, can_delete: false }
const emptyGrid = (modules: AppModule[]): Grid => Object.fromEntries(modules.map((m) => [m.key, { ...OFF }]))

const iconBtn = (enabled: boolean, tone: 'primary' | 'ghost' = 'primary'): React.CSSProperties => ({
  display: 'inline-grid', placeItems: 'center', width: 36, height: 36, borderRadius: 8,
  border: tone === 'ghost' ? '1px solid var(--line)' : 'none',
  background: tone === 'ghost' ? '#fff' : NAVY, color: tone === 'ghost' ? '#64748b' : '#fff',
  cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.4,
})

export default function RolesTab() {
  const canEdit = usePerm('users', 'edit')
  const [modules, setModules] = useState<AppModule[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [grid, setGrid] = useState<Grid>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) ?? null, [roles, selectedId])

  async function refreshRoles(selectId?: string) {
    const rs = await listRoles()
    setRoles(rs)
    if (selectId) setSelectedId(selectId)
  }

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const [ms, rs] = await Promise.all([listModules(), listRoles()])
        if (c) return
        setModules(ms); setRoles(rs)
        if (rs.length) setSelectedId(rs[0].id)
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to load roles') }
      finally { if (!c) setLoading(false) }
    })()
    return () => { c = true }
  }, [])

  useEffect(() => {
    if (!selectedId || !modules.length) return
    let c = false
    ;(async () => {
      const perms = await getRolePermissions(selectedId)
      if (c) return
      const g = emptyGrid(modules)
      for (const p of perms) {
        g[p.module_key] = { can_read: p.can_read, can_add: p.can_add, can_edit: p.can_edit, can_delete: p.can_delete }
      }
      setGrid(g)
      setName(roles.find((x) => x.id === selectedId)?.name ?? ''); setDirty(false)
    })()
    return () => { c = true }
  }, [selectedId, modules, roles])

  function toggle(moduleKey: string, op: keyof Cell) {
    if (!canEdit) return
    setGrid((g) => ({ ...g, [moduleKey]: { ...(g[moduleKey] ?? OFF), [op]: !(g[moduleKey] ?? OFF)[op] } }))
    setDirty(true)
  }
  function toggleRowAll(moduleKey: string, value: boolean) {
    if (!canEdit) return
    setGrid((g) => ({ ...g, [moduleKey]: { can_read: value, can_add: value, can_edit: value, can_delete: value } }))
    setDirty(true)
  }

  async function onSave() {
    if (!selectedId) return
    setSaving(true)
    try {
      await updateRole(selectedId, { name: name.trim() })
      const rows: RolePerm[] = modules.map((m) => ({ module_key: m.key, ...(grid[m.key] ?? OFF) }))
      await saveRolePermissions(selectedId, rows)
      toast.success('Role saved'); setDirty(false)
      await refreshRoles(selectedId)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function onCreate() {
    const nm = newName.trim()
    if (!nm) return
    try {
      const r = await createRole({ name: nm })
      setNewName(''); await refreshRoles(r.id); toast.success('Role created')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Create failed') }
  }

  async function onDelete() {
    if (!selected || selected.is_preset) return
    if (!window.confirm(`Delete role "${selected.name}"? Assigned users lose these permissions.`)) return
    try {
      await deleteRole(selected.id); setSelectedId(null); await refreshRoles(); toast.success('Role deleted')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
  }

  const cb = (checked: boolean, on: () => void): React.ReactElement => (
    <input type="checkbox" checked={checked} disabled={!canEdit} onChange={on}
      style={{ width: 16, height: 16, accentColor: NAVY, cursor: canEdit ? 'pointer' : 'default' }} />
  )

  if (loading) return <div className="muted pad">Loading...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {roles.map((r) => (
            <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                textAlign: 'left', cursor: 'pointer', fontSize: 13,
                background: r.id === selectedId ? NAVY : '#fff', color: r.id === selectedId ? '#fff' : '#334155',
                border: `1px solid ${r.id === selectedId ? NAVY : 'var(--line)'}`, borderRadius: 8, padding: '9px 12px' }}>
              <span>{r.name}</span>
              {r.is_preset && <span style={{ fontSize: 9, opacity: .6, letterSpacing: '.06em' }}>PRESET</span>}
            </button>
          ))}
        </div>
        {canEdit && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <input className="input input--sm" placeholder="New role" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void onCreate() }} style={{ flex: 1 }} />
            <button type="button" onClick={onCreate} disabled={!newName.trim()} title="Add role" style={iconBtn(!!newName.trim())}>
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      {selected ? (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
            <input className="input input--sm" value={name} disabled={!canEdit}
              onChange={(e) => { setName(e.target.value); setDirty(true) }}
              style={{ flex: 1, maxWidth: 320, fontSize: 15, fontWeight: 600 }} />
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              {!selected.is_preset && canEdit && (
                <button type="button" onClick={onDelete} title="Delete role" style={iconBtn(true, 'ghost')}><Trash2 size={16} /></button>
              )}
              <button type="button" onClick={onSave} disabled={!canEdit || !dirty || saving} title="Save" style={iconBtn(canEdit && dirty && !saving)}>
                <Save size={16} />
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Module</th>
                  {OPS.map((o) => <th key={o.key} style={{ width: 78, textAlign: 'center' }}>{o.label}</th>)}
                  <th style={{ width: 58, textAlign: 'center' }}>All</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => {
                  const row = grid[m.key] ?? OFF
                  const allOn = row.can_read && row.can_add && row.can_edit && row.can_delete
                  return (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      {OPS.map((o) => <td key={o.key} style={{ textAlign: 'center' }}>{cb(row[o.key], () => toggle(m.key, o.key))}</td>)}
                      <td style={{ textAlign: 'center' }}>{cb(allOn, () => toggleRowAll(m.key, !allOn))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="muted pad">Select a role to edit its permissions.</div>
      )}
    </div>
  )
}

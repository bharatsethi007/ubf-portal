import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Save, Trash2 } from 'lucide-react'
import { usePerm } from '../../access/PermissionsProvider'
import {
  createRole, deleteRole, getRolePermissions, listModules, listRoles,
  saveRolePermissions, updateRole, type AppModule, type Role, type RolePerm,
} from './usersApi'

type Cell = { can_read: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }
type Grid = Record<string, Cell>
const OPS: Array<{ key: keyof Cell; label: string }> = [
  { key: 'can_read', label: 'Read' }, { key: 'can_add', label: 'Add' },
  { key: 'can_edit', label: 'Edit' }, { key: 'can_delete', label: 'Delete' },
]
const OFF: Cell = { can_read: false, can_add: false, can_edit: false, can_delete: false }
const emptyGrid = (modules: AppModule[]): Grid =>
  Object.fromEntries(modules.map((m) => [m.key, { ...OFF }]))

export default function RolesTab() {
  const canEdit = usePerm('users', 'edit')
  const [modules, setModules] = useState<AppModule[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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
      const r = roles.find((x) => x.id === selectedId)
      setName(r?.name ?? ''); setDescription(r?.description ?? ''); setDirty(false)
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
      await updateRole(selectedId, { name: name.trim(), description: description.trim() || null })
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

  if (loading) return <div className="muted pad">Loading...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {roles.map((r) => (
            <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                textAlign: 'left', cursor: 'pointer', fontSize: 13,
                background: r.id === selectedId ? '#0A2472' : '#fff',
                color: r.id === selectedId ? '#fff' : 'inherit',
                border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
              }}>
              <span>{r.name}</span>
              {r.is_preset && <span style={{ fontSize: 9, opacity: .7, letterSpacing: '.04em' }}>PRESET</span>}
            </button>
          ))}
        </div>
        {canEdit && (
          <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
            <input className="input input--sm" placeholder="New role name" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void onCreate() }} />
            <button type="button" className="btn btn--inline" onClick={onCreate} disabled={!newName.trim()}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>

      {selected ? (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span className="text-muted-foreground">Role name</span>
              <input className="input input--sm" value={name} disabled={!canEdit}
                onChange={(e) => { setName(e.target.value); setDirty(true) }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, flex: 1, minWidth: 220 }}>
              <span className="text-muted-foreground">Description</span>
              <input className="input input--sm" value={description} disabled={!canEdit}
                onChange={(e) => { setDescription(e.target.value); setDirty(true) }} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--inline" onClick={onSave} disabled={!canEdit || !dirty || saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save'}
              </button>
              {!selected.is_preset && canEdit && (
                <button type="button" className="btn btn--inline" onClick={onDelete}
                  style={{ color: '#b42318', borderColor: '#f0c4c0' }}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
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
                      {OPS.map((o) => (
                        <td key={o.key} style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={row[o.key]} disabled={!canEdit} onChange={() => toggle(m.key, o.key)} />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={allOn} disabled={!canEdit} onChange={() => toggleRowAll(m.key, !allOn)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {selected.is_preset && (
            <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 10 }}>
              This is a preset role. You can tune its permissions but it cannot be deleted.
            </p>
          )}
        </div>
      ) : (
        <div className="muted pad">Select a role to edit its permissions.</div>
      )}
    </div>
  )
}

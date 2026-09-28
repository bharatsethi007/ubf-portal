import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../../supabase'
import { usePerm } from '../../access/PermissionsProvider'
import StaffAvatar from '../../components/staff/StaffAvatar'
import AddUserModal from './AddUserModal'
import UserDetail from './UserDetail'
import { PROFILE_COLS, displayName, type StaffProfile } from './staffProfileApi'

const BLUE = '#2563EB'
type Row = StaffProfile & { role_count: number }

async function loadStaff(): Promise<Row[]> {
  const { data, error } = await supabase.from('staff_users').select(`${PROFILE_COLS},staff_user_roles(role_id)`)
  if (error) throw error
  return ((data ?? []) as unknown as (StaffProfile & { staff_user_roles: unknown[] | null })[])
    .map(({ staff_user_roles, ...p }) => ({ ...p, role_count: staff_user_roles?.length ?? 0 }))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)))
}

export default function UsersTab() {
  const canAdd = usePerm('users', 'add')
  const [rows, setRows] = useState<Row[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [q, setQ] = useState('')

  async function load() {
    try { setRows(await loadStaff()); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load users') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const inactiveCount = rows.filter((r) => !r.is_active).length
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) => (showInactive || r.is_active)
      && (!term || `${displayName(r)} ${r.email ?? ''} ${r.job_title ?? ''}`.toLowerCase().includes(term)))
  }, [rows, showInactive, q])

  const selected = rows.find((r) => r.user_id === selectedId) ?? visible[0] ?? null
  const activeStaff = useMemo(() => rows.filter((r) => r.is_active), [rows])

  if (loading) return <div className="muted pad">Loading…</div>
  if (error) return <div className="muted pad">{error}</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
      <div>
        {/* List toolbar: same 36px row height as the detail header */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input className="input input--sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users"
              style={{ width: '100%', height: 36, paddingLeft: 32, boxSizing: 'border-box' }} />
          </div>
          {canAdd && (
            <button type="button" onClick={() => setShowAdd(true)} title="Add user" aria-label="Add user"
              style={{ display: 'inline-grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, borderRadius: 8, border: 'none', background: BLUE, color: '#fff', cursor: 'pointer' }}>
              <Plus size={18} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visible.map((u) => {
            const on = u.user_id === selected?.user_id
            const name = displayName(u)
            return (
              <button key={u.user_id} type="button" onClick={() => setSelectedId(u.user_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: on ? '#EFF4FF' : '#fff', border: `1px solid ${on ? '#BFD0FB' : 'transparent'}`, borderRadius: 8, padding: '8px 10px' }}>
                <StaffAvatar path={u.avatar_path} name={name} size={30} muted={!u.is_active} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: u.is_active ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.job_title || u.email}
                  </span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 10, color: '#94a3b8', letterSpacing: '.03em' }}>
                  {!u.is_active ? 'DISABLED' : u.is_admin ? 'ADMIN' : u.role_count ? `${u.role_count} role${u.role_count > 1 ? 's' : ''}` : ''}
                </span>
              </button>
            )
          })}
          {visible.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '8px 10px' }}>No users match.</div>}
        </div>

        {inactiveCount > 0 && (
          <button type="button" onClick={() => setShowInactive((v) => !v)}
            style={{ marginTop: 12, background: 'none', border: 'none', padding: '4px 10px', fontSize: 12.5, color: '#64748b', cursor: 'pointer' }}>
            {showInactive ? 'Hide disabled users' : `Show disabled users (${inactiveCount})`}
          </button>
        )}
      </div>

      {selected
        ? <UserDetail key={selected.user_id} profile={selected} staff={activeStaff} allStaff={rows} onChanged={load} onDeleted={() => { setSelectedId(null); void load() }} />
        : <div className="muted pad">Select a user.</div>}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  )
}

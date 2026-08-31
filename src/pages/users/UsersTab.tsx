import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePerm } from '../../access/PermissionsProvider'
import { listStaffWithRoles, type StaffWithRoles } from './usersApi'
import UserAccessPanel from './UserAccessPanel'
import AddUserModal from './AddUserModal'

const NAVY = '#2563EB'

export default function UsersTab() {
  const canAdd = usePerm('users', 'add')
  const [rows, setRows] = useState<StaffWithRoles[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    try { const d = await listStaffWithRoles(); setRows(d); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load users') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const selected = rows.find((r) => r.user_id === selectedId) ?? null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        {canAdd && (
          <button type="button" onClick={() => setShowAdd(true)} title="Add user"
            style={{ display: 'inline-grid', placeItems: 'center', width: 36, height: 36, borderRadius: 8, border: 'none', background: NAVY, color: '#fff', cursor: 'pointer' }}>
            <Plus size={18} />
          </button>
        )}
      </div>

      {loading ? <div className="muted pad">Loading...</div>
        : error ? <div className="muted pad">{error}</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {rows.map((u) => (
                <button key={u.user_id} type="button" onClick={() => setSelectedId(u.user_id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: 13,
                    background: u.user_id === selectedId ? NAVY : '#fff', color: u.user_id === selectedId ? '#fff' : '#334155',
                    border: `1px solid ${u.user_id === selectedId ? NAVY : 'var(--line)'}`, borderRadius: 8, padding: '9px 12px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email ?? '-'}</span>
                  <span style={{ flexShrink: 0, fontSize: 9, opacity: .7, letterSpacing: '.04em' }}>
                    {u.is_admin ? 'ADMIN' : (u.roles.length > 0 ? `${u.roles.length} role${u.roles.length > 1 ? 's' : ''}` : '')}
                  </span>
                </button>
              ))}
            </div>
            {selected ? (
              <UserAccessPanel key={selected.user_id} userId={selected.user_id} email={selected.email} isAdmin={selected.is_admin} onChanged={load} />
            ) : (
              <div className="muted pad">Select a user to manage their roles and access.</div>
            )}
          </div>
        )}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { listStaffWithRoles, type StaffWithRoles } from './usersApi'
import UserAccessPanel from './UserAccessPanel'

export default function UsersTab() {
  const [rows, setRows] = useState<StaffWithRoles[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try { const d = await listStaffWithRoles(); setRows(d); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load users') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const selected = rows.find((r) => r.user_id === selectedId) ?? null

  if (loading) return <div className="muted pad">Loading...</div>
  if (error) return <div className="muted pad">{error}</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((u) => (
          <button key={u.user_id} type="button" onClick={() => setSelectedId(u.user_id)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%',
              textAlign: 'left', cursor: 'pointer', fontSize: 13,
              background: u.user_id === selectedId ? '#0A2472' : '#fff',
              color: u.user_id === selectedId ? '#fff' : 'inherit',
              border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px',
            }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email ?? '-'}</span>
            <span style={{ flexShrink: 0, fontSize: 9, opacity: .8 }}>
              {u.is_admin ? 'ADMIN' : (u.roles.length > 0 ? `${u.roles.length} role${u.roles.length > 1 ? 's' : ''}` : '')}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <UserAccessPanel
          key={selected.user_id}
          userId={selected.user_id}
          email={selected.email}
          isAdmin={selected.is_admin}
          onChanged={load}
        />
      ) : (
        <div className="muted pad">Select a user to manage their roles and access.</div>
      )}
    </div>
  )
}

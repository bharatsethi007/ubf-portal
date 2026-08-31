import { useEffect, useState } from 'react'
import { listStaffWithRoles, type StaffWithRoles } from './usersApi'

export default function UsersTab() {
  const [rows, setRows] = useState<StaffWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let c = false
    ;(async () => {
      try { const d = await listStaffWithRoles(); if (!c) setRows(d) }
      catch (e) { if (!c) setError(e instanceof Error ? e.message : 'Failed to load users') }
      finally { if (!c) setLoading(false) }
    })()
    return () => { c = true }
  }, [])

  if (loading) return <div className="muted pad">Loading...</div>
  if (error) return <div className="muted pad">{error}</div>

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Email</th>
            <th style={{ textAlign: 'left' }}>Roles</th>
            <th style={{ width: 90, textAlign: 'center' }}>Admin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.user_id}>
              <td>{u.email ?? '-'}</td>
              <td>
                {u.roles.length
                  ? u.roles.map((r) => (
                      <span key={r.id} style={{ display: 'inline-block', marginRight: 6, marginBottom: 2, padding: '1px 8px', borderRadius: 999, background: '#eef1f8', color: '#0A2472', fontSize: 11, fontWeight: 600 }}>{r.name}</span>
                    ))
                  : <span className="text-muted-foreground">No roles</span>}
              </td>
              <td style={{ textAlign: 'center' }}>{u.is_admin ? 'Yes' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 10 }}>
        Assigning roles and per-user overrides comes in the next step.
      </p>
    </div>
  )
}

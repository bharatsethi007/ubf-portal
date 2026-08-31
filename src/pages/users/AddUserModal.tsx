import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { createStaffUser, listRoles, type Role } from './usersApi'

const NAVY = '#2563EB'

export default function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState<string | null>(null)

  useEffect(() => { listRoles().then(setRoles).catch(() => { /* ignore */ }) }, [])

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function submit() {
    const em = email.trim().toLowerCase()
    if (!em.includes('@')) { setError('Enter a valid email.'); return }
    setBusy(true); setError('')
    try {
      const res = await createStaffUser(em, [...selected])
      onCreated()
      if (res.email_sent) { toast.success('Invite email sent'); onClose() }
      else { setLink(res.link ?? null); toast.message('User created - share the invite link below') }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to create user') }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,27,45,.35)', display: 'grid', placeItems: 'center', zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(460px, calc(100% - 32px))', padding: 24, background: '#fff', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Add staff user</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>

        {link ? (
          <div>
            <p className="text-muted-foreground" style={{ fontSize: 13, marginBottom: 8 }}>Email could not be sent. Share this link (valid 7 days):</p>
            <input className="input input--sm" readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ width: '100%', marginBottom: 16 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff', cursor: 'pointer', fontSize: 14 }}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 12, color: '#334155', marginBottom: 4 }}>Email address</label>
            <input className="input input--sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" style={{ width: '100%', marginBottom: 18 }} autoFocus />

            <div style={{ fontSize: 12, color: '#334155', marginBottom: 8 }}>Roles</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {roles.map((r) => {
                const on = selected.has(r.id)
                return (
                  <button key={r.id} type="button" onClick={() => toggle(r.id)}
                    style={{ fontSize: 13, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? NAVY : 'var(--line)'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#334155' }}>
                    {r.name}
                  </button>
                )
              })}
            </div>

            {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={onClose} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button type="button" onClick={submit} disabled={busy || !email.trim()} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff', cursor: busy || !email.trim() ? 'default' : 'pointer', opacity: busy || !email.trim() ? 0.5 : 1, fontSize: 14 }}>
                {busy ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

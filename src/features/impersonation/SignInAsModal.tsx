import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { searchTargets, startImpersonation, type ImpersonationTarget } from './impersonationApi'

// Super admin: search a staff user and sign in as them (help desk, access checks).
export default function SignInAsModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ImpersonationTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  useEffect(() => {
    let live = true
    setLoading(true)
    const t = window.setTimeout(() => {
      searchTargets(q)
        .then((r) => { if (live) setRows(r) })
        .catch(() => { if (live) toast.error('Search failed') })
        .finally(() => { if (live) setLoading(false) })
    }, 200)
    return () => { live = false; window.clearTimeout(t) }
  }, [q])

  async function pick(r: ImpersonationTarget) {
    setBusy(r.user_id)
    try { await startImpersonation(r.user_id) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not sign in as user'); setBusy(null) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,27,45,.35)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sign-in-as-title"
        style={{ width: 'min(520px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', padding: 20, background: '#fff', borderRadius: 12, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 id="sign-in-as-title" style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>Sign in as</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b' }}>
          You see exactly what they see. Changes save as them and are logged against you. Ends after 60 minutes.
        </p>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="input" autoFocus placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', paddingLeft: 32, boxSizing: 'border-box' }} aria-label="Search staff" />
        </div>
        <div style={{ overflowY: 'auto', minHeight: 120 }}>
          {!loading && rows.length === 0 && <p style={{ fontSize: 13, color: '#64748b' }}>No staff found.</p>}
          {rows.map((r) => (
            <button key={r.user_id} type="button" className="dropdown-item" disabled={!!busy} onClick={() => void pick(r)}
              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 10px', textAlign: 'left' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--ink)' }}>{r.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[r.email, r.job_title].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                {busy === r.user_id ? 'Signing in…' : [r.is_admin ? 'Admin' : null, r.companies].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { currentImpersonation, returnToSelf, type ActiveImpersonation } from './impersonationApi'

// Thin bar above the topbar while a super admin works as another user. Auto-returns at expiry.
export default function ImpersonationBanner() {
  const [imp, setImp] = useState<ActiveImpersonation | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void currentImpersonation().then(setImp) }, [])

  useEffect(() => {
    if (!imp) return
    const ms = new Date(imp.expires_at).getTime() - Date.now()
    const t = window.setTimeout(() => void returnToSelf(), Math.max(ms, 0))
    return () => window.clearTimeout(t)
  }, [imp])

  if (!imp) return null

  async function back() { setBusy(true); await returnToSelf() }

  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
      padding: '6px 16px', background: '#fff7ed', borderBottom: '1px solid #fdba74', color: '#9a3412', fontSize: 13,
    }}>
      <span>
        Signed in as <strong style={{ fontWeight: 600 }}>{imp.target_name ?? imp.target_email}</strong>
        {imp.actor_name ? ` by ${imp.actor_name}` : ''}. Actions are logged. Ends {format(new Date(imp.expires_at), 'h:mm a')}.
      </span>
      <button type="button" className="btn btn--secondary btn--inline" disabled={busy} onClick={() => void back()}>
        {busy ? 'Returning…' : 'Return to my account'}
      </button>
    </div>
  )
}

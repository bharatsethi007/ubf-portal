import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ubLogo from './assets/ub-logo.jpg'
import { supabase } from './supabase'

const MIN = 8
const expired = 'This link has expired or was already used. Contact your administrator for a new invite.'

export default function StaffSetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')?.trim() ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const missing = useMemo(() => !token, [token])

  const wrap: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F4F5F7' }
  const card: React.CSSProperties = { width: '100%', maxWidth: 380, padding: '0 24px' }
  const input: React.CSSProperties = { width: '100%', height: 44, padding: '0 12px', marginBottom: 14, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'block', fontSize: 13, color: '#334155', marginBottom: 6 }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN) { setError(`Password must be at least ${MIN} characters.`); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('staff-redeem-token', { body: { token, password } })
      if (fnErr) {
        let msg = expired
        const resp = (fnErr as unknown as { context?: Response }).context
        if (resp && typeof resp.json === 'function') {
          try { const b = await resp.json(); if (b?.error && b.error !== 'invalid_token') msg = b.message ?? b.error } catch { /* ignore */ }
        }
        setError(msg); return
      }
      const email = (data as { email?: string })?.email
      if (email) {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signErr) { setError('Password saved. Please sign in with your new password.'); return }
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setBusy(false) }
  }

  if (missing) {
    return (
      <div style={wrap}>
        <div style={card}>
          <img src={ubLogo} alt="UB Freight" style={{ height: 44, marginBottom: 20 }} />
          <h1 style={{ fontSize: 22, color: '#0A2472', margin: '0 0 8px' }}>Invalid link</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>{expired}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <form onSubmit={submit} style={card}>
        <img src={ubLogo} alt="UB Freight" style={{ height: 44, marginBottom: 24 }} />
        <h1 style={{ fontSize: 24, fontWeight: 500, color: '#0A2472', margin: '0 0 8px' }}>Set your password</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>Choose a password for your UB Freight staff account.</p>
        <label style={label}>New password</label>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
        <label style={label}>Confirm password</label>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} />
        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy || !password || !confirm}
          style={{ width: '100%', height: 44, marginTop: 6, border: 'none', borderRadius: 8, background: busy || !password || !confirm ? '#94a3b8' : '#0A2472', color: '#fff', fontSize: 15, fontWeight: 500, cursor: busy || !password || !confirm ? 'default' : 'pointer' }}>
          {busy ? 'Saving...' : 'Save and continue'}
        </button>
      </form>
    </div>
  )
}

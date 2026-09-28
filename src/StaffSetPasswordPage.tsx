import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from './supabase'
import AuthLayout, { authStyles as s, primaryButton } from './auth/AuthLayout'
import PasswordChecklist from './auth/PasswordChecklist'
import { passwordMeetsPolicy } from './auth/passwordPolicy'

const EXPIRED = 'This link has expired or was already used.'

export default function StaffSetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')?.trim() ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(!token)

  const strong = passwordMeetsPolicy(password)
  const matches = password.length > 0 && password === confirm
  const disabled = busy || !strong || !matches

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (disabled) return
    setBusy(true); setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('staff-redeem-token', { body: { token, password } })
      if (fnErr) {
        const resp = (fnErr as unknown as { context?: Response }).context
        let body: { error?: string; message?: string } = {}
        try { if (resp && typeof resp.json === 'function') body = await resp.json() } catch { /* ignore */ }
        if (body.error === 'weak_password') { setError(body.message ?? 'Password does not meet the requirements.'); return }
        setExpired(true); return
      }
      const email = (data as { email?: string })?.email
      if (email) {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signErr) { navigate('/', { replace: true }); return }
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setBusy(false) }
  }

  if (expired) {
    return (
      <AuthLayout>
        <h1 style={s.title}>Link expired</h1>
        <p style={s.sub}>{EXPIRED} Request a new one below.</p>
        <Link to="/forgot-password" style={{ ...primaryButton(false), display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          Send a new reset link
        </Link>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link to="/" style={s.link}>← Back to sign in</Link>
        </div>
      </AuthLayout>
    )
  }

  const eyeBtn = { position: 'absolute', right: 8, top: 10, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 } as const

  return (
    <AuthLayout>
      <form onSubmit={submit}>
        <h1 style={s.title}>Set a new password</h1>
        <p style={s.sub}>Choose a strong password for your UB Freight Console account.</p>

        <label style={s.label}>New password</label>
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus value={password}
            onChange={(e) => setPassword(e.target.value)} style={{ ...s.input, paddingRight: 40 }} />
          <button type="button" onClick={() => setShow((v) => !v)} style={eyeBtn} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <PasswordChecklist password={password} />

        <label style={s.label}>Confirm password</label>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} style={{ ...s.input, marginBottom: 8 }} />
        {confirm.length > 0 && !matches && <div style={s.error}>Passwords do not match.</div>}
        {error && <div style={s.error}>{error}</div>}

        <button type="submit" disabled={disabled} style={primaryButton(disabled)}>
          {busy ? 'Saving…' : 'Save and sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}

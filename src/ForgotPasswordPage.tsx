import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from './supabase'
import AuthLayout, { authStyles as s, primaryButton } from './auth/AuthLayout'

export default function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) { setError('Enter a valid email address.'); return }
    setBusy(true); setError(null)
    const { error: fnErr } = await supabase.functions.invoke('staff-forgot-password', { body: { email: email.trim() } })
    setBusy(false)
    if (fnErr) { setError('Could not send the email. Try again in a minute.'); return }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout>
        <h1 style={s.title}>Check your email</h1>
        <p style={s.sub}>
          If <strong>{email.trim()}</strong> has a UB Freight Console account, we have sent a link to reset the password.
          The link expires in 1 hour.
        </p>
        <p style={{ ...s.sub, fontSize: 13 }}>Not there? Check junk, or wait a minute and try again.</p>
        <Link to="/" style={s.link}>← Back to sign in</Link>
      </AuthLayout>
    )
  }

  const disabled = busy || !email
  return (
    <AuthLayout>
      <form onSubmit={submit}>
        <h1 style={s.title}>Reset your password</h1>
        <p style={s.sub}>Enter your work email and we will send you a link to set a new password.</p>
        <label style={s.label}>Email address</label>
        <input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={s.input} />
        {error && <div style={s.error}>{error}</div>}
        <button type="submit" disabled={disabled} style={primaryButton(disabled)}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link to="/" style={s.link}>← Back to sign in</Link>
        </div>
      </form>
    </AuthLayout>
  )
}

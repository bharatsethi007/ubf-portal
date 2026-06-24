import { useState } from 'react'
import { supabase } from './supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function signIn() {
    setErr('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setErr('We could not sign you in. Use your UB Freight staff email or contact IT.')
    else setSent(true)
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">UB</span> Freight</div>
        <h1>Internal dashboard</h1>
        {sent ? (
          <p className="muted">Check your inbox — we sent a secure sign-in link to <b>{email}</b>.</p>
        ) : (
          <>
            <p className="muted">Staff sign-in. Enter your work email for a one-time link.</p>
            <input
              className="input"
              type="email"
              placeholder="you@ubfreight.co.nz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && signIn()}
            />
            <button className="btn" type="button" onClick={signIn} disabled={busy || !email}>
              {busy ? 'Sending…' : 'Send sign-in link'}
            </button>
            {err && <p className="error">{err}</p>}
          </>
        )}
      </div>
    </div>
  )
}

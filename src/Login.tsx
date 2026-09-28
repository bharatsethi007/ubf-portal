import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabase'
import AuthLayout, { authStyles as s, primaryButton } from './auth/AuthLayout'

export default function Login({ overlay }: { overlay?: ReactNode } = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setError('Invalid email or password')
    // On success the auth listener in App swaps this screen out.
  }

  const disabled = busy || !email || !password

  return (
    <AuthLayout overlay={overlay}>
      <h1 style={{ ...s.title, margin: '0 0 24px' }}>Login to your account</h1>

      <label style={s.label}>Email address</label>
      <input
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pw')?.focus()}
        style={s.input}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={s.label}>Password</label>
        <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} style={s.link}>
          Forgot password?
        </Link>
      </div>
      <input
        id="pw"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && signIn()}
        style={{ ...s.input, marginBottom: 8 }}
      />

      {error && <div style={s.error}>{error}</div>}

      <button type="button" onClick={signIn} disabled={disabled} style={primaryButton(disabled)}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </AuthLayout>
  )
}

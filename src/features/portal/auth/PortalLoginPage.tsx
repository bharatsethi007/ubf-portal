import { FormEvent, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../supabase'
import PortalBrandMark from '../components/PortalBrandMark'
import PortalLoginVisual from './PortalLoginVisual'
import '../layout/portalTheme.css'
import './portalLoginPage.css'

type Props = {
  session: Session | null
  authReady: boolean
}

export default function PortalLoginPage({ session, authReady }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotOpen, setForgotOpen] = useState(false)

  if (authReady && session) return <Navigate to="/portal" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setBusy(true)
    setError(null)
    setForgotOpen(false)
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (signErr) {
      setError('Incorrect email or password')
      return
    }
  }

  return (
    <div className="portal-root portal-login">
      <section className="portal-login__form-panel">
        <div className="portal-login__form-inner">
          <PortalBrandMark className="portal-login__brand" />
          <h1 className="portal-login__heading">Sign in to your portal</h1>
          <p className="portal-login__sub">
            Track your shipments, bookings and invoices in one place.
          </p>

          <form className="portal-login__form" onSubmit={submit}>
            <label className="portal-login__label">
              Email
              <input
                type="email"
                className="portal-login__input"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="portal-login__label">
              Password
              <span className="portal-login__pw-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="portal-login__input"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="portal-login__pw-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {error && <p className="portal-login__error" role="alert">{error}</p>}

            <button
              type="submit"
              className="portal-btn-primary portal-login__submit"
              disabled={busy || !email.trim() || !password}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <button
            type="button"
            className="portal-login__forgot"
            onClick={() => setForgotOpen((v) => !v)}
          >
            Forgot password?
          </button>
          {forgotOpen && (
            <p className="portal-login__forgot-note">
              Contact UB Freight to reset your password. Self-service reset is coming soon.
            </p>
          )}

          <p className="portal-login__footer">
            Need access? Contact your UB Freight representative.
          </p>
        </div>
      </section>

      <PortalLoginVisual />
    </div>
  )
}

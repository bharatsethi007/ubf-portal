import { FormEvent, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ubLogo from '../../../assets/ub-logo.jpg'
import { MIN_PASSWORD_LENGTH, redeemPortalToken } from '../../../lib/portalActivationApi'
import { supabase } from '../../../supabase'
import '../layout/portalTheme.css'
import './setPasswordPage.css'

const TOKEN_ERRORS: Record<string, string> = {
  invalid_token: 'This link has expired or was already used. Contact UB Freight for a new one.',
  token_used: 'This link has expired or was already used. Contact UB Freight for a new one.',
  token_expired: 'This link has expired or was already used. Contact UB Freight for a new one.',
}

export default function SetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')?.trim() ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokenMissing = useMemo(() => !token, [token])

  if (tokenMissing) {
    return (
      <div className="portal-root portal-set-pw">
        <div className="portal-card portal-set-pw__card">
          <h1 className="portal-heading">Invalid link</h1>
          <p className="portal-set-pw__muted">
            This link has expired or was already used. Contact UB Freight for a new one.
          </p>
        </div>
      </div>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { email } = await redeemPortalToken(token, password)
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signErr) {
        setError('Password saved but sign-in failed. Try logging in with your new password.')
        return
      }
      navigate('/portal', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(TOKEN_ERRORS[msg] ?? msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="portal-root portal-set-pw">
      <div className="portal-card portal-set-pw__card">
        <img src={ubLogo} alt="UB Freight" className="portal-set-pw__logo" />
        <h1 className="portal-heading">Set your password</h1>
        <p className="portal-set-pw__muted">Choose a password for your UB Freight customer portal account.</p>
        <form className="portal-set-pw__form" onSubmit={submit}>
          <label className="portal-set-pw__label">
            New password
            <input
              type="password"
              className="portal-set-pw__input"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="portal-set-pw__label">
            Confirm password
            <input
              type="password"
              className="portal-set-pw__input"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <p className="portal-set-pw__error">{error}</p>}
          <button type="submit" className="portal-btn-primary portal-set-pw__submit" disabled={busy || !password || !confirm}>
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

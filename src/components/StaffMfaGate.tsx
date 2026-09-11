import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../supabase'

const NAVY = '#0A2472'
type Mode = 'checking' | 'enroll' | 'challenge' | 'ok'
type Enrollment = { factorId: string; qr: string; secret: string }

// Module-scoped so React StrictMode's double-mount shares ONE enrollment
// instead of creating two factors (which made scanned codes fail to verify).
let enrollPromise: Promise<Enrollment> | null = null
function resetEnrollment() { enrollPromise = null }

async function doEnroll(): Promise<Enrollment> {
  const { data: list } = await supabase.auth.mfa.listFactors()
  const all = (list as unknown as { all?: { id: string; status: string }[] })?.all ?? []
  for (const f of all) {
    if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}
function getEnrollment(): Promise<Enrollment> {
  if (!enrollPromise) {
    enrollPromise = doEnroll().catch((e) => { enrollPromise = null; throw e })
  }
  return enrollPromise
}

export default function StaffMfaGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('checking')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = useCallback(async () => {
    setError('')
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel === 'aal2') { resetEnrollment(); setMode('ok'); return }
    const { data: list } = await supabase.auth.mfa.listFactors()
    const verified = list?.totp ?? []
    if (verified.length > 0) { setFactorId(verified[0].id); setMode('challenge'); return }
    try {
      const e = await getEnrollment()
      setFactorId(e.factorId); setQr(e.qr); setSecret(e.secret); setMode('enroll')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start MFA setup')
      setMode('enroll')
    }
  }, [])

  useEffect(() => { void check() }, [check])

  async function submit() {
    if (!factorId || code.trim().length < 6) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    setBusy(false)
    if (e) { setError('That code was not accepted. Use the current code from your app.'); setCode(''); return }
    resetEnrollment()
    setCode('')
    await check()
  }

  async function signOut() { resetEnrollment(); await supabase.auth.signOut() }

  if (mode === 'ok') return <>{children}</>
  if (mode === 'checking') return <div className="center muted">Loading…</div>

  const isEnroll = mode === 'enroll'
  return (
    <div className="center" style={{ minHeight: '100vh' }}>
      <div className="auth-card" style={{ maxWidth: 400, width: '100%', textAlign: 'left' }}>
        <div className="brand" style={{ marginBottom: 12 }}><span className="brand-mark">UB</span> Freight</div>
        <h1 style={{ fontSize: 20, color: NAVY, margin: '0 0 6px' }}>
          {isEnroll ? 'Set up two-factor authentication' : 'Two-factor authentication'}
        </h1>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 18px' }}>
          {isEnroll
            ? 'Staff accounts require an authenticator app. Scan the QR code with Google Authenticator, Authy, or 1Password, then enter the 6-digit code to finish.'
            : 'Enter the current 6-digit code from your authenticator app.'}
        </p>

        {isEnroll && qr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
            <img src={qr} alt="MFA QR code" style={{ width: 200, height: 200 }} />
            {secret && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                Can’t scan? Enter this key:
                <code style={{ display: 'block', marginTop: 4, fontSize: 13, color: '#334155', wordBreak: 'break-all' }}>{secret}</code>
              </div>
            )}
          </div>
        )}

        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="123456"
          autoFocus
          style={{ width: '100%', height: 44, padding: '0 12px', letterSpacing: 4, fontSize: 18,
            border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box', textAlign: 'center' }}
        />

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</div>}

        <button type="button" onClick={submit} disabled={busy || code.length < 6}
          style={{ width: '100%', height: 44, marginTop: 14, border: 'none', borderRadius: 8,
            background: busy || code.length < 6 ? '#94a3b8' : NAVY, color: '#fff', fontSize: 15, fontWeight: 500,
            cursor: busy || code.length < 6 ? 'default' : 'pointer' }}>
          {busy ? 'Verifying…' : isEnroll ? 'Verify & finish' : 'Verify'}
        </button>

        <button type="button" onClick={signOut}
          style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}

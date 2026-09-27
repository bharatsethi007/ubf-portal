import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../supabase'
import Login from '../Login'
import MfaDialog from './MfaDialog'

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
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'UB Freight Console',
    friendlyName: user?.email ?? 'staff',
  })
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

  async function submit(value = code) {
    if (!factorId || value.length < 6 || busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: value })
    setBusy(false)
    if (e) { setError('That code was not accepted. Use the current code from your app.'); setCode(''); return }
    resetEnrollment()
    setCode('')
    await check()
  }

  function onCodeChange(v: string) {
    setCode(v)
    if (v.length === 6) void submit(v)
  }

  async function signOut() { resetEnrollment(); await supabase.auth.signOut({ scope: 'local' }) }

  if (mode === 'ok') return <>{children}</>

  // Keep the login screen as the backdrop; MFA step shows as a popup on top.
  return (
    <Login
      overlay={mode === 'checking' ? null : (
        <MfaDialog
          mode={mode}
          qr={qr}
          secret={secret}
          code={code}
          busy={busy}
          error={error}
          onCodeChange={onCodeChange}
          onSubmit={() => void submit()}
          onSignOut={signOut}
        />
      )}
    />
  )
}

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import '../auth/portalLoginPage.css'

const CONSENT_LABEL =
  'I agree to receive shipment status and booking updates from UB Freight via WhatsApp. Reply STOP anytime to opt out.'

type FnPayload = {
  error?: string
  message?: string
  ok?: boolean
  bound?: boolean
  wa_id_masked?: string
  opted_in?: boolean
  to_masked?: string
  remaining?: number
}

type InvokeError = Error & { context?: Response }

type Phase = 'loading' | 'linked' | 'setup'
type SetupStep = 'phone' | 'code'

async function readFnPayload(error: InvokeError | null): Promise<FnPayload | null> {
  if (!error?.context) return null
  try {
    return (await error.context.json()) as FnPayload
  } catch {
    return null
  }
}

async function invokeVerify(body: Record<string, unknown>): Promise<FnPayload> {
  const { data, error } = await supabase.functions.invoke('whatsapp-verify', { body })
  const payload = ((data as FnPayload | null) ?? (await readFnPayload(error as InvokeError | null))) ?? {}
  if (error && !payload.error && !payload.ok && payload.bound === undefined) {
    throw new Error(error.message || 'Request failed')
  }
  return payload
}

function startErrorMessage(code: string | undefined): string {
  if (code === 'rate_limited') return 'Too many attempts, try again later.'
  if (code === 'send_failed' || code === 'invalid_number') {
    return "We couldn't send a code to that number. Check the number and try again."
  }
  return 'Something went wrong. Please try again.'
}

export default function WhatsAppSettingsPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [setupStep, setSetupStep] = useState<SetupStep>('phone')
  const [waId, setWaId] = useState('+64')
  const [waIdMasked, setWaIdMasked] = useState('')
  const [consent, setConsent] = useState(false)
  const [code, setCode] = useState('')
  const [toMasked, setToMasked] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forceResendStart, setForceResendStart] = useState(false)

  const loadStatus = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      const res = await invokeVerify({ action: 'status' })
      if (res.bound) {
        setWaIdMasked(res.wa_id_masked ?? '')
        setPhase('linked')
      } else {
        setPhase('setup')
        setSetupStep('phone')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load WhatsApp status')
      setPhase('setup')
      setSetupStep('phone')
    }
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  function resetSetup() {
    setSetupStep('phone')
    setCode('')
    setToMasked('')
    setError(null)
    setForceResendStart(false)
    setConsent(false)
    setWaId('+64')
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    const trimmed = waId.trim()
    if (!trimmed || !consent || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await invokeVerify({ action: 'start', wa_id: trimmed, consent: true })
      if (res.error) {
        setError(startErrorMessage(res.error))
        return
      }
      setWaId(trimmed)
      setToMasked(res.to_masked ?? trimmed)
      setSetupStep('code')
      setCode('')
      setForceResendStart(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : startErrorMessage(undefined))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(e?: FormEvent) {
    e?.preventDefault()
    const trimmed = code.replace(/\D/g, '')
    if (trimmed.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await invokeVerify({ action: 'confirm', wa_id: waId.trim(), code: trimmed })
      if (res.ok) {
        toast.success('WhatsApp number verified')
        await loadStatus()
        return
      }
      if (res.error === 'invalid_code') {
        const left = res.remaining ?? 0
        setError(`Incorrect code, ${left} attempt${left === 1 ? '' : 's'} left`)
        return
      }
      if (res.error === 'no_active_code' || res.error === 'too_many_attempts') {
        setForceResendStart(true)
        setError('This code has expired or too many attempts were made.')
        return
      }
      setError(res.message ?? 'Verification failed. Please try again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <>
        <div className="portal-title-row">
          <div>
            <h1 className="portal-title">WhatsApp</h1>
            <div className="portal-subtitle">Link your number for shipment updates</div>
          </div>
        </div>
        <div className="portal-card portal-card--pad">
          <p className="portal-empty">Loading…</p>
        </div>
      </>
    )
  }

  if (phase === 'linked') {
    return (
      <>
        <div className="portal-title-row">
          <div>
            <h1 className="portal-title">WhatsApp</h1>
            <div className="portal-subtitle">Your linked number for shipment updates</div>
          </div>
        </div>
        <div className="portal-card portal-card--pad" style={{ maxWidth: 520 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 999, fontSize: 12, fontWeight: 600, color: 'var(--portal-green)',
              background: 'var(--portal-green-bg)',
            }}>
              <CheckCircle2 size={14} /> Verified
            </span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--portal-ink)', margin: '0 0 8px' }}>
            {waIdMasked || 'WhatsApp linked'}
          </p>
          <p className="portal-card-meta" style={{ marginBottom: 20 }}>
            You&apos;ll receive updates on this number. Text STOP on WhatsApp anytime to opt out.
          </p>
          <button type="button" className="portal-btn-primary" onClick={() => { setPhase('setup'); resetSetup() }}>
            Change number
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="portal-title-row">
        <div>
          <h1 className="portal-title">WhatsApp</h1>
          <div className="portal-subtitle">Link your number for shipment updates</div>
        </div>
      </div>

      <div className="portal-card portal-card--pad" style={{ maxWidth: 520 }}>
        <h2 className="portal-card-title" style={{ marginBottom: 6 }}>Connect WhatsApp</h2>
        <p className="portal-card-meta" style={{ marginBottom: 20 }}>
          Link your WhatsApp number to track shipments and receive updates.
        </p>

        {setupStep === 'phone' ? (
          <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
              WhatsApp number
              <input
                type="tel"
                className="portal-login__input"
                value={waId}
                onChange={(e) => setWaId(e.target.value)}
                placeholder="+64 …"
                autoComplete="tel"
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, lineHeight: 1.45, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>{CONSENT_LABEL}</span>
            </label>
            {error ? <p style={{ color: 'var(--portal-red)', fontSize: 13, margin: 0 }}>{error}</p> : null}
            <button type="submit" className="portal-btn-primary" disabled={busy || !waId.trim() || !consent}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {toMasked ? (
              <p className="portal-card-meta" style={{ margin: 0 }}>Code sent to {toMasked}</p>
            ) : null}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
              Verification code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="portal-login__input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                autoComplete="one-time-code"
              />
            </label>
            {error ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ color: 'var(--portal-red)', fontSize: 13, margin: 0 }}>{error}</p>
                {forceResendStart ? (
                  <button type="button" className="portal-login__forgot" style={{ textAlign: 'left', padding: 0 }}
                    onClick={() => resetSetup()}>
                    Resend code
                  </button>
                ) : null}
              </div>
            ) : null}
            <button type="submit" className="portal-btn-primary" disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            {!forceResendStart ? (
              <button type="button" className="portal-login__forgot" style={{ padding: 0, alignSelf: 'flex-start' }}
                disabled={busy} onClick={() => void sendCode()}>
                Resend code
              </button>
            ) : null}
          </form>
        )}
      </div>
    </>
  )
}

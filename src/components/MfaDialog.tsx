import { useEffect, useRef } from 'react'
import ubLogo from '../assets/ub-logo.jpg'

const NAVY = '#0A2472'

type Props = {
  mode: 'enroll' | 'challenge'
  qr: string | null
  secret: string | null
  code: string
  busy: boolean
  error: string
  onCodeChange: (v: string) => void
  onSubmit: () => void
  onSignOut: () => void
}

export default function MfaDialog({ mode, qr, secret, code, busy, error, onCodeChange, onSubmit, onSignOut }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isEnroll = mode === 'enroll'
  const ready = code.length === 6 && !busy

  useEffect(() => { inputRef.current?.focus() }, [mode])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(10, 36, 114, 0.35)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, padding: '28px 28px 20px',
          boxShadow: '0 20px 50px rgba(10, 36, 114, 0.25)', boxSizing: 'border-box',
        }}
      >
        <img src={ubLogo} alt="UB Freight" style={{ height: 40, marginBottom: 20 }} />
        <h2 id="mfa-title" style={{ fontSize: 20, fontWeight: 500, color: NAVY, margin: '0 0 6px' }}>
          {isEnroll ? 'Set up two-factor authentication' : 'Enter your verification code'}
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px', lineHeight: 1.5 }}>
          {isEnroll
            ? 'Scan the QR code with Google Authenticator, Authy or 1Password, then enter the 6-digit code.'
            : 'Open your authenticator app and enter the 6-digit code for UB Freight Console.'}
        </p>

        {isEnroll && qr && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
            <img src={qr} alt="MFA QR code" style={{ width: 180, height: 180 }} />
            {secret && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                Can’t scan? Enter this key:
                <code style={{ display: 'block', marginTop: 4, fontSize: 13, color: '#334155', wordBreak: 'break-all' }}>{secret}</code>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && ready && onSubmit()}
          placeholder="123456"
          style={{
            width: '100%', height: 48, padding: '0 12px', letterSpacing: 6, fontSize: 20,
            border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box', textAlign: 'center',
          }}
        />

        {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</div>}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!ready}
          style={{
            width: '100%', height: 44, marginTop: 14, border: 'none', borderRadius: 8,
            background: ready ? NAVY : '#94a3b8', color: '#fff', fontSize: 15, fontWeight: 500,
            cursor: ready ? 'pointer' : 'default',
          }}
        >
          {busy ? 'Verifying…' : isEnroll ? 'Verify & finish' : 'Verify'}
        </button>

        <button
          type="button"
          onClick={onSignOut}
          style={{ width: '100%', marginTop: 10, padding: 6, background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
        >
          Cancel and sign out
        </button>
      </div>
    </div>
  )
}

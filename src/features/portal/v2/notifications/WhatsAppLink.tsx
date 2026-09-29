import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { confirmWaCode, sendWaCode } from './waApi'

const CONSENT = 'I agree to receive shipment, booking and invoice updates from UB Freight on WhatsApp. I can reply STOP at any time to opt out.'

/** Two-step number link: send a code on WhatsApp, then enter it. */
export default function WhatsAppLink({ onLinked, onCancel }: { onLinked: () => void; onCancel?: () => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [number, setNumber] = useState('+64 ')
  const [consent, setConsent] = useState(false)
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function send(e?: FormEvent) {
    e?.preventDefault()
    if (busy || !consent || number.replace(/\D/g, '').length < 8) return
    setBusy(true); setErr(null)
    const r = await sendWaCode(number.trim())
    setBusy(false)
    if (!r.ok) { setErr(r.message); return }
    setSentTo(r.toMasked); setCode(''); setStep('code')
  }

  async function confirm(e?: FormEvent) {
    e?.preventDefault()
    if (busy || code.length !== 6) return
    setBusy(true); setErr(null)
    const r = await confirmWaCode(number.trim(), code)
    setBusy(false)
    if (r.ok) { onLinked(); return }
    setErr(r.message)
    if (r.restart) setStep('phone')
  }

  if (step === 'code') {
    return (
      <form className="pv3-walink" onSubmit={confirm}>
        <p className="pv3-walink__hint">We sent a 6-digit code on WhatsApp to <b>{sentTo}</b>.</p>
        <div className="pv3-field">
          <label htmlFor="wa-code">Code</label>
          <input id="wa-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="123456"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </div>
        {err && <p className="pv3-nset__err pv3-walink__err">{err}</p>}
        <div className="pv3-walink__actions">
          <button type="button" className="pv3-textbtn" disabled={busy} onClick={() => void send()}>Resend code</button>
          <button type="button" className="pv3-btn pv3-btn--ghost" disabled={busy} onClick={() => { setStep('phone'); setErr(null) }}>Back</button>
          <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy || code.length !== 6}>
            {busy && <Loader2 size={14} className="pv3-spin" />} Verify
          </button>
        </div>
      </form>
    )
  }

  return (
    <form className="pv3-walink" onSubmit={send}>
      <div className="pv3-field">
        <label htmlFor="wa-num">WhatsApp number</label>
        <input id="wa-num" type="tel" autoComplete="tel" placeholder="+64 21 123 4567" value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>
      <label className="pv3-walink__consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{CONSENT}</span>
      </label>
      {err && <p className="pv3-nset__err pv3-walink__err">{err}</p>}
      <div className="pv3-walink__actions">
        {onCancel && <button type="button" className="pv3-btn pv3-btn--ghost" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy || !consent || number.replace(/\D/g, '').length < 8}>
          {busy && <Loader2 size={14} className="pv3-spin" />} Send code
        </button>
      </div>
    </form>
  )
}

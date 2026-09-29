import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { recentShipments, sendMessage, type ShipmentOption } from './messagesApi'

type Props = { job: number | null; onCreated: (threadId: string) => void; onClose: () => void }

/** Start a conversation: about a shipment, or a general question. */
export default function NewThread({ job, onCreated, onClose }: Props) {
  const [ships, setShips] = useState<ShipmentOption[]>([])
  const [about, setAbout] = useState<string>(job != null ? String(job) : '')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { void recentShipments().then(setShips) }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setErr('')
    try {
      const id = await sendMessage({ body: text, subject: subject.trim() || undefined, job: about ? Number(about) : null })
      onCreated(id)
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not send') } finally { setBusy(false) }
  }

  return (
    <form className="pv3-msg__new" onSubmit={(e) => void submit(e)}>
      <header className="pv3-msg__chead">
        <div><b>New message</b><span className="pv3-muted">Our team replies here, usually within business hours.</span></div>
        <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Cancel"><X size={16} /></button>
      </header>
      <div className="pv3-msg__fields">
        <label><span>About</span>
          <select value={about} onChange={(e) => setAbout(e.target.value)}>
            <option value="">General question</option>
            {job != null && !ships.some((s) => s.job_unique === job) && <option value={job}>This shipment</option>}
            {ships.map((s) => <option key={s.job_unique} value={s.job_unique}>{s.label}</option>)}
          </select>
        </label>
        {!about && (
          <label><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="e.g. Rates for next month" /></label>
        )}
        <label className="pv3-msg__grow"><span>Message</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={4000} required autoFocus placeholder="How can we help?" />
        </label>
      </div>
      {err && <div className="pv3-error" style={{ margin: '0 16px' }}>{err}</div>}
      <div className="pv3-msg__compose pv3-msg__compose--end">
        <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={15} className="pv3-spin" /> : <Send size={15} />} Send
        </button>
      </div>
    </form>
  )
}

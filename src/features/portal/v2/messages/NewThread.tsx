import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import Composer from './Composer'
import { recentShipments, sendMessage, type ShipmentOption } from './messagesApi'

type Props = { job: number | null; onCreated: (threadId: string) => void; onClose: () => void }

/** New conversation: pick what it's about, then type like any chat. */
export default function NewThread({ job, onCreated, onClose }: Props) {
  const [ships, setShips] = useState<ShipmentOption[]>([])
  const [about, setAbout] = useState<string>(job != null ? String(job) : '')
  const [subject, setSubject] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => { void recentShipments().then(setShips) }, [])

  async function send(body: string) {
    setErr('')
    try {
      const id = await sendMessage({ body, subject: subject.trim() || undefined, job: about ? Number(about) : null })
      onCreated(id)
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Not delivered. Try again.')
      throw x
    }
  }

  return (
    <div className="im-conv">
      <header className="im-conv__head">
        <button type="button" className="im-back" onClick={onClose} aria-label="Cancel"><ChevronLeft size={22} /></button>
        <div className="im-conv__title"><b>New message</b><span>Our team replies here during business hours</span></div>
        <button type="button" className="im-cancel" onClick={onClose}>Cancel</button>
      </header>

      <div className="im-to">
        <label className="im-to__row">
          <span>To</span>
          <b className="im-to__chip">UB Freight</b>
        </label>
        <label className="im-to__row">
          <span>About</span>
          <select value={about} onChange={(e) => setAbout(e.target.value)}>
            <option value="">General question</option>
            {job != null && !ships.some((s) => s.job_unique === job) && <option value={job}>This shipment</option>}
            {ships.map((s) => <option key={s.job_unique} value={s.job_unique}>{s.label}</option>)}
          </select>
        </label>
        {!about && (
          <label className="im-to__row">
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder="Optional" />
          </label>
        )}
      </div>

      <div className="im-stream im-stream--empty">
        <p className="im-break">Ask about a shipment, a booking, rates or anything else.</p>
      </div>

      {err && <p className="im-err">{err}</p>}
      <Composer onSend={send} autoFocus placeholder="Message UB Freight" />
    </div>
  )
}

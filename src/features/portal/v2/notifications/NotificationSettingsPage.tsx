import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Mail } from 'lucide-react'
import { KINDS, fetchPrefs, savePrefs } from './notifyApi'
import './notifications.css'

/** Per-user choice of which updates arrive by email. The bell always shows everything. */
export default function NotificationSettingsPage() {
  const [email, setEmail] = useState(false)
  const [off, setOff] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetchPrefs().then((p) => { setEmail(p.email_enabled); setOff(p.off_kinds ?? []); setLoaded(true) })
  }, [])

  async function persist(nextEmail: boolean, nextOff: string[]) {
    setEmail(nextEmail); setOff(nextOff); setBusy(true); setMsg(null)
    try { await savePrefs(nextEmail, nextOff); setMsg({ ok: true, text: 'Saved' }) }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' }) }
    finally { setBusy(false) }
  }

  const toggleKind = (k: string) => void persist(email, off.includes(k) ? off.filter((x) => x !== k) : [...off, k])

  return (
    <div className="pv3-page pv3-nset">
      <Link to="/portal" className="pv3-textbtn pv3-nset__back"><ArrowLeft size={14} /> Back</Link>
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Notifications</h1>
          <p>Email updates are off until you turn them on. Everything always shows under the bell in the portal.</p>
        </div>
        <span className="pv3-nset__status" aria-live="polite">
          {busy ? <><Loader2 size={14} className="pv3-spin" /> Saving</> : msg ? <span className={msg.ok ? 'pv3-nset__ok' : 'pv3-nset__err'}>{msg.ok && <Check size={14} />} {msg.text}</span> : null}
        </span>
      </div>

      <section className="pv3-card pv3-nset__card pv3-rise">
        <label className="pv3-nset__row pv3-nset__row--master">
          <span className="pv3-nset__ico"><Mail size={18} /></span>
          <span className="pv3-nset__txt"><b>Email me updates</b><span>Off by default. One email groups everything new since the last one, sent during NZ business hours.</span></span>
          <input type="checkbox" className="pv3-switch" checked={email} disabled={!loaded} onChange={(e) => void persist(e.target.checked, off)} />
        </label>
        <div className={`pv3-nset__list${email ? '' : ' pv3-nset__list--off'}`}>
          {KINDS.map((k) => (
            <label key={k.kind} className="pv3-nset__row">
              <i className={`pv3-bell__dot pv3-bell__dot--${k.tone}`} />
              <span className="pv3-nset__txt"><b>{k.label}</b><span>{k.help}</span></span>
              <input type="checkbox" className="pv3-switch" checked={!off.includes(k.kind)} disabled={!loaded || !email} onChange={() => toggleKind(k.kind)} />
            </label>
          ))}
        </div>
      </section>
      <p className="pv3-foot">Updates come from our system and live tracking. Where we don't have tracking for a shipment yet, you may not get departed or arrived updates.</p>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, Loader2, Mail, MessageCircle, PauseCircle } from 'lucide-react'
import { KINDS, fetchPrefs, savePrefs, type Prefs, type PrefsPatch } from './notifyApi'
import { fetchWaStatus, type WaStatus } from './waApi'
import WhatsAppLink from './WhatsAppLink'
import './notifications.css'

const EMPTY: Prefs = { email_enabled: false, off_kinds: [], wa_enabled: false, wa_off_kinds: [], seen_at: null }

/** Per-user choice of channel (email, WhatsApp) and which updates each one carries. The bell always shows everything. */
export default function NotificationSettingsPage() {
  const [p, setP] = useState<Prefs>(EMPTY)
  const [wa, setWa] = useState<WaStatus>({ linked: false })
  const [loaded, setLoaded] = useState(false)
  const [linking, setLinking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const [prefs, status] = await Promise.all([fetchPrefs(), fetchWaStatus()])
    setP(prefs); setWa(status); setLoaded(true)
  }, [])
  useEffect(() => { void load() }, [load])

  async function persist(patch: PrefsPatch, next: Prefs) {
    setP(next); setBusy(true); setMsg(null)
    try {
      await savePrefs(patch)
      setMsg({ ok: true, text: 'Saved' })
      if (patch.wa) setWa(await fetchWaStatus())
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save' }) }
    finally { setBusy(false) }
  }

  const flip = (list: string[], k: string) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k])
  const waOn = wa.linked && p.wa_enabled && wa.opted_in !== false
  const paused = wa.linked && p.wa_enabled && wa.opted_in === false

  async function linked() {
    setLinking(false)
    await load()
    setMsg({ ok: true, text: 'WhatsApp linked' })
  }

  return (
    <div className="pv3-page pv3-nset">
      <Link to="/portal" className="pv3-textbtn pv3-nset__back"><ArrowLeft size={14} /> Back</Link>
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Notifications</h1>
          <p>Choose how we reach you. Everything always shows under the bell in the portal.</p>
        </div>
        <span className="pv3-nset__status" aria-live="polite">
          {busy ? <><Loader2 size={14} className="pv3-spin" /> Saving</> : msg ? <span className={msg.ok ? 'pv3-nset__ok' : 'pv3-nset__err'}>{msg.ok && <Check size={14} />} {msg.text}</span> : null}
        </span>
      </div>

      <div className="pv3-nset__channels pv3-rise">
        <section className="pv3-card pv3-nset__chan">
          <header>
            <span className="pv3-nset__ico"><Mail size={18} /></span>
            <div className="pv3-nset__txt"><b>Email</b><span>One email groups everything new, sent in NZ business hours.</span></div>
            <input type="checkbox" className="pv3-switch" aria-label="Email updates" checked={p.email_enabled} disabled={!loaded}
              onChange={(e) => void persist({ email: e.target.checked }, { ...p, email_enabled: e.target.checked })} />
          </header>
        </section>

        <section className="pv3-card pv3-nset__chan">
          <header>
            <span className="pv3-nset__ico pv3-nset__ico--wa"><MessageCircle size={18} /></span>
            <div className="pv3-nset__txt">
              <b>WhatsApp</b>
              {wa.linked
                ? <span className="pv3-nset__wanum"><CheckCircle2 size={13} /> {wa.masked} verified</span>
                : <span>Instant updates on your phone. Reply to chat with our team.</span>}
            </div>
            {wa.linked && (
              <input type="checkbox" className="pv3-switch" aria-label="WhatsApp updates" checked={waOn} disabled={!loaded}
                onChange={(e) => void persist({ wa: e.target.checked }, { ...p, wa_enabled: e.target.checked })} />
            )}
          </header>
          {paused && <p className="pv3-nset__note"><PauseCircle size={14} /> Paused because you replied STOP. Switch on to resume.</p>}
          {loaded && !wa.linked && !linking && (
            <button type="button" className="pv3-btn pv3-btn--primary pv3-nset__cta" onClick={() => setLinking(true)}>Link WhatsApp</button>
          )}
          {wa.linked && !linking && <button type="button" className="pv3-textbtn pv3-nset__change" onClick={() => setLinking(true)}>Change number</button>}
          {linking && <WhatsAppLink onLinked={() => void linked()} onCancel={() => setLinking(false)} />}
        </section>
      </div>

      <section className="pv3-card pv3-nset__card pv3-rise" style={{ animationDelay: '.06s' }}>
        <div className="pv3-nset__grid pv3-nset__grid--head">
          <span>Update</span><span>Email</span><span>WhatsApp</span>
        </div>
        {KINDS.map((k) => (
          <div key={k.kind} className="pv3-nset__grid">
            <span className="pv3-nset__kind">
              <i className={`pv3-bell__dot pv3-bell__dot--${k.tone}`} />
              <span className="pv3-nset__txt"><b>{k.label}</b><span>{k.help}</span></span>
            </span>
            <input type="checkbox" className="pv3-switch" aria-label={`${k.label} by email`} checked={p.email_enabled && !p.off_kinds.includes(k.kind)}
              disabled={!loaded || !p.email_enabled} onChange={() => { const off = flip(p.off_kinds, k.kind); void persist({ off }, { ...p, off_kinds: off }) }} />
            <input type="checkbox" className="pv3-switch" aria-label={`${k.label} on WhatsApp`} checked={waOn && !p.wa_off_kinds.includes(k.kind)}
              disabled={!loaded || !waOn} onChange={() => { const waOff = flip(p.wa_off_kinds, k.kind); void persist({ waOff }, { ...p, wa_off_kinds: waOff }) }} />
          </div>
        ))}
      </section>
      <p className="pv3-foot">Updates come from our system and live tracking. Where we don't have tracking for a shipment yet, you may not get departed or arrived updates. WhatsApp updates older than two days are not sent.</p>
    </div>
  )
}

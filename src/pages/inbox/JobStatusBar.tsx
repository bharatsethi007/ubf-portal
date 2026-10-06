// Status bar above the email: which stage the linked job is at, plus the suggested next action.
// Exports: Booked, Pickup/Drop-off, Checked in, SLI, Consol, Departed. Imports: booking flow stages.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Link2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import { linkJob } from './inboxApi'
import { inboxAction } from './EmailParts'

type Step = { key: string; label: string; state: 'done' | 'current' | 'todo'; detail?: string | null }
type Status = {
  booking: { id: string; ref: string; module: string; status: string } | null
  steps?: Step[]
  next?: { label: string; action: string | null; due?: string | null; urgency?: string | null } | null
}

export default function JobStatusBar({ convId, refreshKey, onChanged }: { convId: string; refreshKey: string; onChanged: () => void }) {
  const nav = useNavigate()
  const [s, setS] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    supabase.rpc('inbox_job_status', { p_conv: convId }).then(({ data }) => { if (live) setS((data as Status) ?? null) })
    return () => { live = false }
  }, [convId, refreshKey])

  if (!s) return null
  const b = s.booking
  const open = () => b && nav(`/bookings/${b.module}/${b.id}/edit`)

  async function act() {
    const a = s?.next?.action
    if (!a) return
    if (a === 'open' || a === 'sli') return open()
    if (a === 'ea-booking' || a === 'create-booking') return inboxAction(a)
    if (a === 'pickup' && b) {
      setBusy(true)
      const { data, error } = await supabase.rpc('booking_create_pickup', { p_booking: b.id, p_ready: null })
      setBusy(false)
      if (error) return toast.error(error.message)
      toast.success(`Pickup ${(data as { consignment_no?: string })?.consignment_no ?? ''} booked`)
      onChanged()
    }
  }

  const nextBtn = s.next ? (
    s.next.action ? (
      <button type="button" className={`ibx-btn${b ? '' : ' ibx-btn--primary'}`} style={{ height: 30, flex: 'none' }} disabled={busy} onClick={() => void act()}>
        {busy ? 'Working…' : s.next.label}
      </button>
    ) : <span className="ibx-jsb__wait">{s.next.label}</span>
  ) : null

  if (!b) {
    return (
      <div className="ibx-jsb">
        <span style={{ color: '#605E5C' }}>Not linked to a job.</span>
        <button type="button" className="ibx-link" onClick={() => inboxAction('job', { mode: 'link' })}><Link2 size={13} style={{ verticalAlign: -2 }} /> Link to job</button>
        <span style={{ marginLeft: 'auto' }} />{nextBtn}
      </div>
    )
  }

  return (
    <div className="ibx-jsb">
      <button type="button" className="ibx-jsb__ref ibx-mono" onClick={open} title="Open job">{b.ref}</button>
      <ol className="ibx-jsb__steps">
        {(s.steps ?? []).map((st) => (
          <li key={st.key} className={`ibx-jsb__step ibx-jsb__step--${st.state}`} title={st.detail ?? undefined}>
            <span className="ibx-jsb__dot">{st.state === 'done' ? <Check size={10} strokeWidth={3} /> : null}</span>
            <span className="ibx-jsb__label">{st.label}</span>
            {st.detail && st.state !== 'todo' && st.key !== 'booked' ? <span className="ibx-jsb__detail ibx-ellip">{st.detail}</span> : null}
          </li>
        ))}
      </ol>
      <span style={{ marginLeft: 'auto' }} />
      {nextBtn}
      <button type="button" className="ibx-mail__icon" style={{ width: 26, height: 26, flex: 'none' }} title="Unlink job" aria-label="Unlink job"
        onClick={() => void linkJob(convId, null).then(() => { toast.success('Unlinked'); onChanged() })}><X size={14} /></button>
    </div>
  )
}

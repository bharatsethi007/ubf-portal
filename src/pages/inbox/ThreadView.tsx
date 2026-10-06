import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Package, Phone, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import Composer from './Composer'
import MessageTimeline from './MessageTimeline'
import { assign, setStatus, type InboxDetail, type StaffOption } from './inboxApi'
import { avatarColors, CHANNEL_META, initials } from './inboxFormat'

type Props = { detail: InboxDetail; staff: StaffOption[]; me: string; onChanged: () => void }

const SNOOZES: { key: string; label: string; at: () => Date }[] = [
  { key: '1h', label: '1 hour', at: () => new Date(Date.now() + 3600e3) },
  { key: '4h', label: '4 hours', at: () => new Date(Date.now() + 4 * 3600e3) },
  { key: 'tom', label: 'Tomorrow 9am', at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d } },
  { key: 'wk', label: 'Next Monday 9am', at: () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d } },
]

// Title = whoever wrote this thread. Account's WhatsApp contact only when this thread is that chat.
export function whoOf(d: InboxDetail): string {
  const sender = [...d.messages].reverse().find((m) => m.direction === 'in' && m.sender_name)?.sender_name
  return sender
    ?? (d.conversation.contact_linked ? d.contact?.display_name : null)
    ?? d.account?.name ?? d.contact?.display_name ?? 'Unknown'
}

export default function ThreadView({ detail, staff, me, onChanged }: Props) {
  const c = detail.conversation
  const [busy, setBusy] = useState(false)
  const who = whoOf(detail)
  const unknown = !detail.account && !detail.contact?.contact_type
  const channels = Array.from(new Set(detail.messages.filter((m) => m.kind === 'message').map((m) => m.channel)))
  const focus = detail.shipments.find((s) => s.focus)
  const typeLabel = detail.account ? 'Customer' : detail.contact?.contact_type ?? 'Unknown number'

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true)
    try { await fn(); if (ok) toast.success(ok); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <main className="ibx-thread">
      <header className="ibx-thread__head">
        <span className="ibx-av" style={avatarColors(who, unknown)}>{initials(who)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ibx-ellip">{who}</h2>
            <span className={`ibx-chip ${unknown ? 'ibx-chip--late' : 'ibx-chip--done'}`} style={{ textTransform: 'capitalize' }}>{typeLabel}</span>
          </div>
          <div className="ibx-ellip" style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
            {detail.account?.name ?? (detail.contact ? `+${detail.contact.wa_id}` : '')}
            {channels.length ? ` · via ${channels.map((ch) => CHANNEL_META[ch].label).join(' and ')}` : ''}
            {c.subject && c.subject !== 'WhatsApp' ? ` · ${c.subject}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {detail.contact ? (
            <a className="ibx-btn ibx-btn--icon" href={`tel:+${detail.contact.wa_id}`} title="Call" aria-label="Call"><Phone size={16} /></a>
          ) : null}
          <select className="ibx-select" style={{ height: 34 }} aria-label="Assignee" disabled={busy}
            value={c.assignee_id ?? ''} onChange={(e) => run(() => assign(c.id, e.target.value || null))}>
            <option value="">Unassigned</option>
            <option value={me}>Me</option>
            {staff.filter((s) => s.user_id !== me).map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
          {c.eff_status !== 'closed' ? (
            <select className="ibx-select" style={{ height: 34 }} aria-label="Snooze" disabled={busy} value=""
              onChange={(e) => {
                const s = SNOOZES.find((x) => x.key === e.target.value)
                if (s) void run(() => setStatus(c.id, 'snoozed', s.at().toISOString()), `Snoozed until ${s.label.toLowerCase()}`)
              }}>
              <option value="">{c.eff_status === 'snoozed' ? 'Snoozed' : 'Snooze'}</option>
              {SNOOZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          ) : null}
          {c.eff_status === 'closed' || c.eff_status === 'snoozed' ? (
            <button type="button" className="ibx-btn" disabled={busy} onClick={() => run(() => setStatus(c.id, 'open'), 'Reopened')}>
              <RotateCcw size={15} />Reopen
            </button>
          ) : (
            <button type="button" className="ibx-btn ibx-btn--primary" disabled={busy} onClick={() => run(() => setStatus(c.id, 'closed'), 'Closed')}>
              <Check size={15} />Close
            </button>
          )}
        </div>
      </header>

      {focus ? (
        <div className="ibx-strip">
          <Package size={16} color="#0A2472" />
          <Link to={`/bookings/${focus.id}`} className="ibx-mono" style={{ fontWeight: 500 }}>{focus.booking_ref}</Link>
          {focus.stage ? <span className="ibx-chip ibx-chip--ok" style={{ textTransform: 'capitalize' }}>{focus.stage.replace('_', ' ')}</span> : null}
          {focus.next_action ? <span style={{ color: '#334155' }}>Next: <span style={{ color: '#0F172A' }}>{focus.next_action}</span></span> : null}
          {focus.last_free_day ? <span style={{ color: '#64748B' }}>LFD {new Date(focus.last_free_day).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span> : null}
        </div>
      ) : null}

      <MessageTimeline messages={detail.messages} who={who} />
      <Composer detail={detail} who={who} me={me} onSent={onChanged} />
    </main>
  )
}

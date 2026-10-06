import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Package, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import AttachmentViewer from './AttachmentViewer'
import Composer from './Composer'
import ContactDialog from './ContactDialog'
import CreateBookingMenu from './CreateBookingMenu'
import JobDialog from './JobDialog'
import MessageTimeline from './MessageTimeline'
import ThreadActions from './ThreadActions'
import { assign, contactTypeOf, isUnknown, linkJob, setStatus, type EmailAttachment, type InboxDetail, type StaffOption } from './inboxApi'
import { avatarColors, CHANNEL_META, initials } from './inboxFormat'
import { inboxAction } from './EmailParts'

type Props = { detail: InboxDetail; staff: StaffOption[]; me: string; onChanged: () => void }

// Title = whoever wrote this thread. Account's WhatsApp contact only when this thread is that chat.
export function whoOf(d: InboxDetail): string {
  const sender = [...d.messages].reverse().find((m) => m.direction === 'in' && m.sender_name)?.sender_name
  return sender
    ?? (d.conversation.contact_linked ? d.contact?.display_name : null)
    ?? d.conversation.contact_name ?? d.account?.name ?? d.contact?.display_name ?? d.conversation.contact_email ?? 'Unknown'
}

export default function ThreadView({ detail, staff, me, onChanged }: Props) {
  const c = detail.conversation
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ items: EmailAttachment[]; index: number } | null>(null)
  const who = whoOf(detail)
  const unknown = isUnknown(detail)
  const channels = Array.from(new Set(detail.messages.filter((m) => m.kind === 'message').map((m) => m.channel)))
  const focus = detail.shipments.find((s) => s.focus)
  const typeLabel = detail.account ? 'Customer' : contactTypeOf(detail) ?? (detail.email ? 'Unknown sender' : 'Unknown number')

  useEffect(() => {
    const on = (e: Event) => setPreview((e as CustomEvent<{ items: EmailAttachment[]; index: number }>).detail)
    window.addEventListener('ibx:preview', on)
    return () => window.removeEventListener('ibx:preview', on)
  }, [])
  useEffect(() => { setPreview(null) }, [c.id])

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
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="ibx-ellip">{who}</h2>
            <button type="button" title="Change contact type" onClick={() => inboxAction('contact')}
              className={`ibx-chip ${unknown ? 'ibx-chip--late' : 'ibx-chip--done'}`} style={{ textTransform: 'capitalize', border: 0, cursor: 'pointer', font: 'inherit', fontSize: 11.5 }}>
              {typeLabel}
            </button>
          </div>
          <div className="ibx-ellip" style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
            {detail.account ? <Link to={`/customers/${detail.account.account_id}`} style={{ color: 'inherit' }}>{detail.account.name}</Link>
              : detail.email?.contact_email ?? (detail.contact ? `+${detail.contact.wa_id}` : '')}
            {channels.length ? ` · via ${channels.map((ch) => CHANNEL_META[ch].label).join(' and ')}` : ''}
            {c.subject && c.subject !== 'WhatsApp' ? ` · ${c.subject}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <select className="ibx-select" style={{ height: 34 }} aria-label="Assignee" disabled={busy}
            value={c.assignee_id ?? ''} onChange={(e) => run(() => assign(c.id, e.target.value || null))}>
            <option value="">Unassigned</option>
            <option value={me}>Me</option>
            {staff.filter((s) => s.user_id !== me).map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <ThreadActions detail={detail} onChanged={onChanged} />
            <CreateBookingMenu detail={detail} bare />
          </div>
          {c.eff_status === 'open' ? (
            <button type="button" className="ibx-btn ibx-btn--primary" disabled={busy} onClick={() => run(() => setStatus(c.id, 'closed'), 'Closed')}>
              <Check size={15} />Close
            </button>
          ) : (
            <button type="button" className="ibx-btn" disabled={busy} onClick={() => run(() => setStatus(c.id, 'open'), 'Reopened')}>
              <RotateCcw size={15} />{c.eff_status === 'ignored' ? 'Un-ignore' : 'Reopen'}
            </button>
          )}
        </div>
      </header>

      {focus || c.booking_ref ? (
        <div className="ibx-strip">
          <Package size={16} color="#0A2472" />
          <Link to={`/bookings/${focus?.id ?? c.booking_id}`} className="ibx-mono" style={{ fontWeight: 500 }}>{focus?.booking_ref ?? c.booking_ref}</Link>
          {focus?.stage ? <span className="ibx-chip ibx-chip--ok" style={{ textTransform: 'capitalize' }}>{focus.stage.replace('_', ' ')}</span> : null}
          {focus?.next_action ? <span style={{ color: '#334155' }}>Next: <span style={{ color: '#0F172A' }}>{focus.next_action}</span></span> : null}
          {focus?.last_free_day ? <span style={{ color: '#64748B' }}>LFD {new Date(focus.last_free_day).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span> : null}
          {c.booking_id ? (
            <button type="button" className="ibx-mail__icon" style={{ marginLeft: 'auto', width: 26, height: 26 }} title="Unlink job" aria-label="Unlink job"
              onClick={() => run(() => linkJob(c.id, null), 'Unlinked')}><X size={14} /></button>
          ) : null}
        </div>
      ) : null}

      <MessageTimeline messages={detail.messages} who={who} />
      <Composer detail={detail} who={who} me={me} onSent={onChanged} />
      {preview ? <AttachmentViewer items={preview.items} index={preview.index} onClose={() => setPreview(null)} /> : null}
      <JobDialog detail={detail} onChanged={onChanged} />
      <ContactDialog detail={detail} onChanged={onChanged} />
    </main>
  )
}

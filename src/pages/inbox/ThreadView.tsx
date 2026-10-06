import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import AttachmentViewer from './AttachmentViewer'
import Composer from './Composer'
import ContactDialog from './ContactDialog'
import CreateBookingMenu from './CreateBookingMenu'
import EaBookingDialog from './EaBookingDialog'
import JobDialog from './JobDialog'
import JobStatusBar from './JobStatusBar'
import MessageTimeline from './MessageTimeline'
import ThreadActions from './ThreadActions'
import { AssignPicker, SnoozePicker } from './HeaderTools'
import { contactTypeOf, isUnknown, setStatus, type EmailAttachment, type InboxDetail, type StaffOption } from './inboxApi'
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
  const title = c.subject && c.subject !== 'WhatsApp' ? c.subject : who
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
          <h2 className="ibx-ellip" title={title}>{title}</h2>
          <div className="ibx-ellip" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
            <span style={{ color: '#334155' }}>{who}</span>
            <button type="button" title="Who is this?" onClick={() => inboxAction('contact')}
              className={`ibx-chip ${unknown ? 'ibx-chip--late' : 'ibx-chip--done'}`} style={{ textTransform: 'capitalize', border: 0, cursor: 'pointer', font: 'inherit', fontSize: 11 }}>
              {typeLabel}
            </button>
            <span className="ibx-ellip">
              {detail.account ? <Link to={`/customers/${detail.account.account_id}`} style={{ color: 'inherit' }}>{detail.account.name}</Link>
                : detail.email?.contact_email ?? (detail.contact ? `+${detail.contact.wa_id}` : '')}
              {channels.length ? ` · via ${channels.map((ch) => CHANNEL_META[ch].label).join(' and ')}` : ''}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <AssignPicker detail={detail} staff={staff} me={me} onChanged={onChanged} />
          <SnoozePicker detail={detail} onChanged={onChanged} />
          <div style={{ position: 'relative' }}>
            <ThreadActions detail={detail} onChanged={onChanged} hideTrigger={!!detail.email} />
            <CreateBookingMenu detail={detail} bare />
          </div>
          {c.eff_status === 'open' ? (
            <button type="button" className="ibx-btn ibx-btn--primary" style={{ marginLeft: 6 }} disabled={busy} onClick={() => run(() => setStatus(c.id, 'closed'), 'Closed')}>
              <Check size={15} />Close
            </button>
          ) : (
            <button type="button" className="ibx-btn" style={{ marginLeft: 6 }} disabled={busy} onClick={() => run(() => setStatus(c.id, 'open'), 'Reopened')}>
              <RotateCcw size={15} />{c.eff_status === 'ignored' ? 'Un-ignore' : 'Reopen'}
            </button>
          )}
        </div>
      </header>

      <JobStatusBar convId={c.id} refreshKey={`${c.booking_id ?? ''}:${detail.messages.length}`} onChanged={onChanged} />
      <MessageTimeline messages={detail.messages} who={who} />
      <Composer detail={detail} who={who} me={me} onSent={onChanged} />
      {preview ? <AttachmentViewer items={preview.items} index={preview.index} onClose={() => setPreview(null)} /> : null}
      <JobDialog detail={detail} onChanged={onChanged} />
      <EaBookingDialog detail={detail} onChanged={onChanged} />
      <ContactDialog detail={detail} onChanged={onChanged} />
    </main>
  )
}

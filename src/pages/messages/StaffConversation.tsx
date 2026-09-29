import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { getStaffThread, setThreadStatus, staffReply, TEAM, when, type StaffThreadDetail } from './portalMessagesApi'

type Props = { threadId: string | null; onChanged: () => void }

/** One portal conversation for staff: history, reply box, close / reopen. */
export default function StaffConversation({ threadId, onChanged }: Props) {
  const [t, setT] = useState<StaffThreadDetail | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    if (!threadId) { setT(null); return }
    try { setT(await getStaffThread(threadId)) } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load') }
  }, [threadId])

  useEffect(() => { void reload() }, [reload])
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void reload() }, 20_000)
    return () => window.clearInterval(id)
  }, [reload])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [t?.messages.length])

  async function send() {
    const body = text.trim()
    if (!threadId || !body || sending) return
    setSending(true)
    try {
      await staffReply(threadId, body)
      setText('')
      await reload()
      onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not send') } finally { setSending(false) }
  }

  async function toggle() {
    if (!t) return
    try { await setThreadStatus(t.id, t.status === 'open' ? 'closed' : 'open'); await reload(); onChanged() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update') }
  }

  if (!threadId) return <div className="wa-inbox-thread__empty">Select a conversation</div>
  if (!t) return <div className="wa-inbox-thread__empty">Loading…</div>

  return (
    <div className="wa-inbox-thread">
      <header className="wa-inbox-thread__head">
        <div>
          <h2 className="wa-inbox-thread__title">{t.subject}</h2>
          <div className="wa-inbox-thread__meta">
            <Link to={`/customers/${encodeURIComponent(t.account_id)}`}>{t.customer ?? t.account_id}</Link>
            {t.module ? ` · ${TEAM[t.module] ?? t.module}` : ''}
            {t.job_unique != null ? ` · job ${t.job_unique}` : ''}
          </div>
        </div>
        <div className="wa-inbox-thread__chips">
          <span className={`wa-inbox-chip${t.status === 'open' ? ' wa-inbox-chip--ok' : ' wa-inbox-chip--muted'}`}>{t.status === 'open' ? 'Open' : 'Closed'}</span>
          <button type="button" className="text-link" onClick={() => void toggle()}>{t.status === 'open' ? 'Close' : 'Reopen'}</button>
        </div>
      </header>

      <div className="wa-inbox-thread__body">
        {t.messages.map((m) => (
          <div key={m.id} className={`wa-msg ${m.kind === 'staff' ? 'wa-msg--out' : 'wa-msg--in'}`}>
            <span className="wa-msg__type">{m.name ?? (m.kind === 'staff' ? 'UB Freight' : 'Customer')} · {when(m.at)}</span>
            <div className="wa-msg__body">{m.body}</div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <footer className="wa-inbox-thread__foot">
        <textarea className="input wa-inbox-thread__input" rows={2} placeholder="Reply to the customer. They see it in their portal."
          value={text} disabled={sending} maxLength={4000} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} />
        <button type="button" className="btn wa-inbox-thread__send" disabled={sending || !text.trim()} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </footer>
    </div>
  )
}

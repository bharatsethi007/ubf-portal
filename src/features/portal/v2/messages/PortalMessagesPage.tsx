import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquarePlus, MessagesSquare } from 'lucide-react'
import Conversation from './Conversation'
import NewThread from './NewThread'
import { listThreads, when, type Thread } from './messagesApi'
import './messages.css'

/** Customer messaging: conversations with UB Freight, per shipment or general. */
export default function PortalMessagesPage() {
  const [params, setParams] = useSearchParams()
  const active = params.get('t')
  const jobParam = params.get('job')
  const composing = params.get('new') === '1' || (!!jobParam && !active)
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setThreads(await listThreads()); setErr('') } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load') }
  }, [])
  useEffect(() => {
    void load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000)
    return () => window.clearInterval(id)
  }, [load])

  // Coming from a shipment with an open conversation already: go straight to it.
  useEffect(() => {
    if (!jobParam || active || !threads) return
    const open = threads.find((t) => String(t.job_unique) === jobParam && t.status === 'open')
    if (open) setParams({ t: open.id }, { replace: true })
  }, [jobParam, active, threads, setParams])

  const openThread = (id: string) => setParams({ t: id })
  const detailOpen = !!active || composing

  return (
    <div className="pv3-page pv3-msg">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Messages</h1>
          <p>Talk to our team about a shipment, a booking or anything else.</p>
        </div>
        <div className="pv3-head__actions">
          <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setParams({ new: '1' })}><MessageSquarePlus size={15} /> New message</button>
        </div>
      </div>
      {err && <div className="pv3-error">{err}</div>}

      <section className={`pv3-card pv3-msg__layout pv3-rise${detailOpen ? ' pv3-msg__layout--detail' : ''}`}>
        <aside className="pv3-msg__list">
          {!threads && !err && <div className="pv3-skel-list" style={{ padding: 16 }}>{[0, 1, 2, 3].map((i) => <span key={i} className="pv3-skel" />)}</div>}
          {threads?.map((t) => (
            <button key={t.id} type="button" className={`pv3-msg__row${active === t.id ? ' pv3-msg__row--on' : ''}`} onClick={() => openThread(t.id)}>
              <span className="pv3-msg__rtop">
                <b>{t.subject}</b>
                <time>{when(t.last_message_at)}</time>
              </span>
              <span className="pv3-msg__rsub">
                {t.shipment_no ?? t.booking_ref ?? 'General'}{t.status === 'closed' ? ' · Closed' : ''}
              </span>
              <span className="pv3-msg__rprev">
                <span>{t.last_sender === 'staff' ? 'UB Freight: ' : 'You: '}{t.last_preview}</span>
                {t.unread > 0 && <i className="pv3-msg__dot" aria-label={`${t.unread} unread`}>{t.unread}</i>}
              </span>
            </button>
          ))}
          {threads && !threads.length && (
            <div className="pv3-msg__empty">
              <MessagesSquare size={28} />
              <span>No messages yet. Start one about any shipment or question.</span>
            </div>
          )}
        </aside>
        <div className="pv3-msg__detail">
          {composing ? (
            <NewThread job={jobParam ? Number(jobParam) : null} onClose={() => setParams({})}
              onCreated={(id) => { setParams({ t: id }); void load() }} />
          ) : active ? (
            <Conversation threadId={active} onSent={() => void load()} onBack={() => setParams({})} />
          ) : (
            <div className="pv3-msg__empty pv3-msg__empty--pane"><MessagesSquare size={28} /><span>Pick a conversation or start a new one.</span></div>
          )}
        </div>
      </section>
    </div>
  )
}

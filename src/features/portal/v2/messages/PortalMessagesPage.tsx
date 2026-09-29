import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessagesSquare, Package, Search, SquarePen } from 'lucide-react'
import Conversation from './Conversation'
import NewThread from './NewThread'
import { listThreads, when, type Thread } from './messagesApi'
import './messages.css'

/** Customer messaging with UB Freight, laid out like iMessage: conversation list left, chat right. */
export default function PortalMessagesPage() {
  const [params, setParams] = useSearchParams()
  const active = params.get('t')
  const jobParam = params.get('job')
  const composing = params.get('new') === '1' || (!!jobParam && !active)
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [q, setQ] = useState('')
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

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!threads || !s) return threads
    return threads.filter((t) => [t.subject, t.shipment_no, t.booking_ref, t.last_preview].some((v) => (v ?? '').toLowerCase().includes(s)))
  }, [threads, q])

  const detailOpen = !!active || composing

  return (
    <div className="pv3-page im-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Messages</h1>
          <p>Chat with our team about a shipment, a booking or anything else.</p>
        </div>
      </div>
      {err && <div className="pv3-error">{err}</div>}

      <section className={`im-layout pv3-rise${detailOpen ? ' im-layout--detail' : ''}`}>
        <aside className="im-list">
          <div className="im-list__top">
            <label className="im-search">
              <Search size={14} aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search conversations" />
            </label>
            <button type="button" className="im-compose-btn" onClick={() => setParams({ new: '1' })} aria-label="New message" title="New message">
              <SquarePen size={18} />
            </button>
          </div>

          <div className="im-list__rows">
            {!threads && !err && <div className="im-loading im-loading--list"><span /><span /><span /></div>}
            {shown?.map((t) => {
              const unread = t.unread > 0
              const tag = t.shipment_no ?? t.booking_ref
              return (
                <button key={t.id} type="button" className={`im-row${active === t.id ? ' im-row--on' : ''}${unread ? ' im-row--unread' : ''}`}
                  onClick={() => setParams({ t: t.id })}>
                  <i className="im-row__dot" aria-label={unread ? `${t.unread} unread` : undefined} />
                  <span className={`im-avatar${tag ? '' : ' im-avatar--ubf'}`} aria-hidden>{tag ? <Package size={18} /> : 'UB'}</span>
                  <span className="im-row__body">
                    <span className="im-row__top">
                      <b>{t.subject}</b>
                      <time>{when(t.last_message_at)}</time>
                    </span>
                    <span className="im-row__prev">
                      {tag && <em>{tag} · </em>}
                      {t.last_sender === 'staff' ? '' : 'You: '}{t.last_preview}
                    </span>
                  </span>
                </button>
              )
            })}
            {threads && !shown?.length && (
              <div className="im-empty">
                <MessagesSquare size={28} />
                <span>{q ? 'No conversations match.' : 'No messages yet. Tap the pencil to start one.'}</span>
              </div>
            )}
          </div>
        </aside>

        <div className="im-detail">
          {composing ? (
            <NewThread job={jobParam ? Number(jobParam) : null} onClose={() => setParams({})}
              onCreated={(id) => { setParams({ t: id }); void load() }} />
          ) : active ? (
            <Conversation threadId={active} onSent={() => void load()} onBack={() => setParams({})} />
          ) : (
            <div className="im-empty im-empty--pane">
              <MessagesSquare size={32} />
              <span>Pick a conversation or start a new one.</span>
              <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setParams({ new: '1' })}><SquarePen size={15} /> New message</button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

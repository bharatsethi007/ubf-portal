import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Maximize2, MessageCircle, MessagesSquare, Search, SquarePen, X } from 'lucide-react'
import Conversation from './Conversation'
import NewThread from './NewThread'
import { listThreads, when, type Thread } from './messagesApi'
import { UbfAvatar } from './UbfBrand'
import './messages.css'

export type DockTarget = { job?: number | string | null; subject?: string | null; threadId?: string | null; compose?: boolean }
type View = { kind: 'list' } | { kind: 'new'; job: number | null; subject: string | null } | { kind: 'thread'; id: string }
type Ctx = { openMessages: (t?: DockTarget) => void; unread: number; toggle: () => void }

const DockCtx = createContext<Ctx | null>(null)

/** Open the floating messages panel from anywhere in the portal. Falls back to the Messages page outside the shell. */
export function useMessageDock(): Ctx {
  const ctx = useContext(DockCtx)
  const navigate = useNavigate()
  return ctx ?? {
    unread: 0,
    toggle: () => navigate('/portal/messages'),
    openMessages: (t) => {
      const p = new URLSearchParams()
      if (t?.threadId) p.set('t', t.threadId)
      else if (t?.job != null) p.set('job', String(t.job))
      else if (t?.subject || t?.compose) p.set('new', '1')
      if (t?.subject) p.set('subject', t.subject)
      const qs = p.toString()
      navigate(`/portal/messages${qs ? `?${qs}` : ''}`)
    },
  }
}

const POLL_MS = 30_000

/** Global messages (mount inside .pv2-root so theme tokens apply): a floating pill bottom right and a slide-in chat panel, so customers never leave the page they're on. */
export function MessagesDockProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const threadsRef = useRef<Thread[] | null>(null)
  threadsRef.current = threads

  const load = useCallback(async () => {
    try { const t = await listThreads(); setThreads(t); setErr(''); return t } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load'); return null }
  }, [])

  // Poll faster while the panel is open.
  useEffect(() => {
    void load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, open ? 15_000 : POLL_MS)
    return () => window.clearInterval(id)
  }, [load, open])

  const openMessages = useCallback((t?: DockTarget) => {
    setOpen(true); setQ('')
    if (t?.threadId) { setView({ kind: 'thread', id: t.threadId }); return }
    const job = t?.job != null && t.job !== '' ? Number(t.job) : null
    const subject = t?.subject ?? null
    if (job != null) {
      const go = (list: Thread[] | null) => {
        const hit = list?.find((x) => Number(x.job_unique) === job && x.status === 'open')
        setView(hit ? { kind: 'thread', id: hit.id } : { kind: 'new', job, subject })
      }
      if (threadsRef.current) go(threadsRef.current)
      else { setView({ kind: 'new', job, subject }); void load().then(go) }
      return
    }
    setView(subject || t?.compose ? { kind: 'new', job: null, subject } : { kind: 'list' })
  }, [load])

  const toggle = useCallback(() => setOpen((o) => !o), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // The full Messages page already is the chat, so the dock steps aside there.
  const onPage = pathname.startsWith('/portal/messages')
  useEffect(() => { if (onPage) setOpen(false) }, [onPage])

  const unread = useMemo(() => (threads ?? []).reduce((n, t) => n + Number(t.unread || 0), 0), [threads])
  const ctx = useMemo<Ctx>(() => ({ openMessages, unread, toggle }), [openMessages, unread, toggle])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!threads || !s) return threads
    return threads.filter((t) => [t.subject, t.shipment_no, t.booking_ref, t.last_preview].some((v) => (v ?? '').toLowerCase().includes(s)))
  }, [threads, q])

  const fullHref = view.kind === 'thread' ? `/portal/messages?t=${view.id}` : '/portal/messages'

  const ui = (
    <>
      {!onPage && !open && (
        <button type="button" className="im-pill" onClick={() => openMessages()} aria-label={unread ? `Message UBF, ${unread} unread` : 'Message UBF'}>
          <MessageCircle size={19} />
          <span className="im-pill__label">Message UBF</span>
          {unread > 0 && <span className="im-pill__badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
      )}

      {open && !onPage && (
        <section className="im-dock" role="dialog" aria-label="Messages with UB Freight">
          {view.kind === 'list' ? (
            <div className="im-conv">
              <header className="im-conv__head">
                <UbfAvatar size={34} />
                <div className="im-conv__title"><b>Messages</b><span>Our team replies here during business hours</span></div>
                <Link to={fullHref} className="im-dock__icon" title="Open full view" aria-label="Open full view" onClick={() => setOpen(false)}><Maximize2 size={16} /></Link>
                <button type="button" className="im-dock__icon" onClick={() => setOpen(false)} aria-label="Close messages"><X size={18} /></button>
              </header>
              <div className="im-list__top">
                <label className="im-search">
                  <Search size={14} aria-hidden />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search conversations" />
                </label>
                <button type="button" className="im-compose-btn" onClick={() => setView({ kind: 'new', job: null, subject: null })} aria-label="New message" title="New message">
                  <SquarePen size={18} />
                </button>
              </div>
              <div className="im-list__rows">
                {err && <p className="im-err">{err}</p>}
                {!threads && !err && <div className="im-loading im-loading--list"><span /><span /><span /></div>}
                {shown?.map((t) => {
                  const unreadRow = t.unread > 0
                  const tag = t.shipment_no ?? t.booking_ref
                  return (
                    <button key={t.id} type="button" className={`im-row${unreadRow ? ' im-row--unread' : ''}`} onClick={() => setView({ kind: 'thread', id: t.id })}>
                      <i className="im-row__dot" aria-label={unreadRow ? `${t.unread} unread` : undefined} />
                      <UbfAvatar />
                      <span className="im-row__body">
                        <span className="im-row__top"><b>{t.subject}</b><time>{when(t.last_message_at)}</time></span>
                        <span className="im-row__prev">{tag && <em>{tag} · </em>}{t.last_sender === 'staff' ? '' : 'You: '}{t.last_preview}</span>
                      </span>
                    </button>
                  )
                })}
                {threads && !shown?.length && (
                  <div className="im-empty">
                    <MessagesSquare size={28} />
                    <span>{q ? 'No conversations match.' : 'No messages yet.'}</span>
                    {!q && <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setView({ kind: 'new', job: null, subject: null })}><SquarePen size={15} /> New message</button>}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <button type="button" className="im-dock__close" onClick={() => setOpen(false)} aria-label="Close messages"><X size={18} /></button>
              {view.kind === 'new' ? (
                <NewThread key={`${view.job}-${view.subject}`} job={view.job} subject={view.subject}
                  onClose={() => setView({ kind: 'list' })}
                  onCreated={(id) => { setView({ kind: 'thread', id }); void load() }} />
              ) : (
                <Conversation threadId={view.id} onSent={() => void load()} onBack={() => { setView({ kind: 'list' }); void load() }} />
              )}
            </>
          )}
        </section>
      )}
    </>
  )

  return (
    <DockCtx.Provider value={ctx}>
      {children}
      {ui}
    </DockCtx.Provider>
  )
}

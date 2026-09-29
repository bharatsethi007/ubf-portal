import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Settings } from 'lucide-react'
import { ago, fetchNotes, fetchPrefs, kindMeta, markSeen, noteLink, type Note } from './notifyApi'
import './notifications.css'

const POLL_MS = 5 * 60 * 1000

/** Top-bar bell: unread count, latest updates, link to settings. */
export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [seen, setSeen] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [n, p] = await Promise.all([fetchNotes(30), fetchPrefs()])
    setNotes(n)
    setSeen(p.seen_at)
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const isNew = (n: Note) => !seen || n.created_at > seen
  const unread = (notes ?? []).filter(isNew).length

  function toggle() {
    const next = !open
    setOpen(next)
    // Opening the panel counts as reading; keep the highlight on for this view, clear the badge.
    if (next && unread) void markSeen().then(() => setTimeout(() => setSeen(new Date().toISOString()), 4000))
  }

  function go(n: Note) {
    setOpen(false)
    navigate(noteLink(n))
  }

  return (
    <div className="pv3-bell" ref={ref}>
      <button type="button" className="pv2-top__icon pv3-bell__btn" aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
        <Bell size={18} />
        {unread > 0 && <span className="pv3-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="pv3-bell__panel" role="dialog" aria-label="Notifications">
          <header>
            <b>Updates</b>
            <Link to="/portal/settings/notifications" onClick={() => setOpen(false)} className="pv3-bell__set" aria-label="Notification settings">
              <Settings size={15} /> Settings
            </Link>
          </header>
          <ul>
            {!notes && [0, 1, 2].map((i) => <li key={i} className="pv3-bell__skel"><span className="pv3-skel" /></li>)}
            {notes?.map((n) => {
              const k = kindMeta(n.kind)
              return (
                <li key={n.id}>
                  <button type="button" className={`pv3-bell__item${isNew(n) ? ' pv3-bell__item--new' : ''}`} onClick={() => go(n)}>
                    <i className={`pv3-bell__dot pv3-bell__dot--${k.tone}`} />
                    <span className="pv3-bell__txt">
                      <span className="pv3-bell__kind">{k.label} · {ago(n.created_at)}</span>
                      <b>{n.title}</b>
                      {n.body && <span className="pv3-bell__body">{n.body}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
            {notes && !notes.length && (
              <li className="pv3-bell__empty">
                <CheckCheck size={22} />
                <span>No updates yet. We'll post departures, arrivals, ETA changes and new invoices here.</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

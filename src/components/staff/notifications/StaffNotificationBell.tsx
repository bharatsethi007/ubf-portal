import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { ago, linkFor, metaFor, type StaffNote } from './staffNotifyApi'
import { useStaffNotifications } from './useStaffNotifications'

type Tab = 'mine' | 'team'

const panel: React.CSSProperties = {
  position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 380, maxWidth: 'calc(100vw - 24px)', zIndex: 60,
  background: '#fff', border: '1px solid #E4E7EC', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.12)', overflow: 'hidden',
}
const tabBtn = (on: boolean): React.CSSProperties => ({
  border: 'none', background: 'transparent', padding: '10px 2px', marginRight: 16, fontSize: 13, cursor: 'pointer',
  color: on ? '#0A2472' : '#667085', fontWeight: on ? 600 : 400, borderBottom: `2px solid ${on ? '#0A2472' : 'transparent'}`,
})

function Row({ n, onClick }: { n: StaffNote; onClick: () => void }) {
  const m = metaFor(n.kind)
  const Icon = m.icon
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', gap: 10, width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #F2F4F7', background: n.is_read ? '#fff' : '#F5F8FF', cursor: 'pointer' }}>
      <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 7, background: '#F2F4F7', color: m.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, color: '#101828', lineHeight: '18px' }}>{n.title}</span>
        {n.body ? <span style={{ display: 'block', fontSize: 12, color: '#667085', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</span> : null}
        <span style={{ display: 'block', fontSize: 11, color: '#98A2B3', marginTop: 2 }}>{m.label} · {ago(n.created_at)}</span>
      </span>
      {!n.is_read ? <span aria-label="Unread" style={{ width: 8, height: 8, borderRadius: 4, background: '#2563EB', marginTop: 6, flexShrink: 0 }} /> : null}
    </button>
  )
}

export default function StaffNotificationBell({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('mine')
  const ref = useRef<HTMLDivElement>(null)
  const go = useCallback((to: string) => { setOpen(false); navigate(to) }, [navigate])
  const { items, unread, teamUnread, read } = useStaffNotifications(userId, go)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const list = useMemo(() => items.filter((n) => (tab === 'team' ? n.is_team : !n.is_team)), [items, tab])
  const unreadInTab = list.filter((n) => !n.is_read).map((n) => n.id)

  function click(n: StaffNote) {
    if (!n.is_read) void read([n.id])
    const to = linkFor(n)
    if (to) go(to)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="sync-btn wa-topbar-btn" title="Notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Bell size={16} strokeWidth={2} />
        {unread > 0 ? <span className="wa-topbar-btn__badge">{unread > 99 ? '99+' : unread}</span> : null}
      </button>

      {open ? (
        <div style={panel} role="dialog" aria-label="Notifications">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #EAECF0' }}>
            <div>
              <button type="button" style={tabBtn(tab === 'mine')} onClick={() => setTab('mine')}>For me{unread ? ` (${unread})` : ''}</button>
              <button type="button" style={tabBtn(tab === 'team')} onClick={() => setTab('team')} title="Items with no owner yet">Unassigned{teamUnread ? ` (${teamUnread})` : ''}</button>
            </div>
            <button type="button" className="icon-btn" title="Mark all read" aria-label="Mark all read" disabled={!unreadInTab.length}
              onClick={() => void read(unreadInTab)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCheck size={16} />
            </button>
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {list.length === 0
              ? <p style={{ margin: 0, padding: '28px 14px', textAlign: 'center', fontSize: 13, color: '#98A2B3' }}>Nothing here. You're up to date.</p>
              : list.map((n) => <Row key={n.id} n={n} onClick={() => click(n)} />)}
          </div>
        </div>
      ) : null}
    </div>
  )
}

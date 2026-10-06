import { useState } from 'react'
import { CheckCheck, Clock, EyeOff, Inbox, Link2, Mail, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'
import type { Channel, InboxCounts, View } from './inboxApi'
import { CHANNEL_META } from './inboxFormat'

type Props = {
  counts: InboxCounts | null
  view: View; channel: Channel | null; team: string | null
  onView: (v: View) => void; onChannel: (c: Channel | null) => void; onTeam: (t: string | null) => void
}

const VIEWS: { key: View; label: string; icon: typeof User }[] = [
  { key: 'mine', label: 'Mine', icon: User },
  { key: 'unassigned', label: 'Unassigned', icon: Inbox },
  { key: 'unknown', label: 'Unknown senders', icon: Link2 },
  { key: 'all', label: 'All open', icon: Inbox },
  { key: 'snoozed', label: 'Snoozed', icon: Clock },
  { key: 'closed', label: 'Closed', icon: CheckCheck },
  { key: 'ignored', label: 'Ignored', icon: EyeOff },
]

const CHANNELS: Channel[] = ['whatsapp', 'wechat', 'portal']

// Shared mailboxes, in the order ops think about them. Unknown ones still show, after these.
const MAILBOXES: [string, string][] = [
  ['imports.nz@ubfreight.com', 'Imports'], ['exportair.nz@ubfreight.com', 'Export Air'],
  ['exportsea.nz@ubfreight.com', 'Export Sea'], ['salessupport.nz@ubfreight.com', 'Sales Support'],
]
const abbr = (label: string) => { const w = label.split(/\s+/); return (w.length > 1 ? w.map((x) => x[0]).join('') : label).slice(0, 2).toUpperCase() }

const KEY = 'ibx-nav-collapsed'
const readCollapsed = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

export default function InboxNav({ counts, view, channel, team, onView, onChannel, onTeam }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => { const n = !collapsed; setCollapsed(n); try { localStorage.setItem(KEY, n ? '1' : '0') } catch { /* private mode */ } }
  const viewCount = (k: View): number | null => (!counts || k === 'closed' || k === 'ignored' ? null : counts[k] ?? null)
  const known = new Set(MAILBOXES.map(([m]) => m))
  const boxes = [...MAILBOXES, ...Object.keys(counts?.mailboxes ?? {}).filter((m) => !known.has(m)).map((m) => [m, m.split('@')[0]] as [string, string])]

  return (
    <nav className={`ibx-nav ibx-pane${collapsed ? ' ibx-nav--mini' : ''}`} aria-label="Inbox views">
      <div className="ibx-nav__head">
        {collapsed ? null : <h1>Inbox</h1>}
        <button type="button" className="ibx-mail__icon" style={{ width: 28, height: 28 }} onClick={toggle}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
      {VIEWS.map(({ key, label, icon: Icon }) => {
        const on = view === key && !channel && !team
        const n = viewCount(key)
        return (
          <button key={key} type="button" title={label} className={`ibx-navitem${on ? ' ibx-navitem--on' : ''}`}
            onClick={() => { onChannel(null); onTeam(null); onView(key) }}>
            <Icon size={16} strokeWidth={1.8} /><span className="ibx-navitem__text">{label}</span>
            {n ? <span className={`ibx-navitem__count${key === 'unknown' && !on ? ' ibx-navitem__count--alert' : ''}`}>{n}</span> : null}
          </button>
        )
      })}

      <div className="ibx-sect">Mailboxes</div>
      {boxes.map(([m, label]) => {
        const on = team === m
        const n = counts?.mailboxes?.[m]
        return (
          <button key={m} type="button" title={`${label} (${m})`} className={`ibx-navitem${on ? ' ibx-navitem--on' : ''}`}
            onClick={() => { onChannel(null); onView('all'); onTeam(on ? null : m) }}>
            <Mail className="ibx-navitem__icon" size={16} strokeWidth={1.8} /><span className="ibx-navitem__abbr">{abbr(label)}</span>
            <span className="ibx-navitem__text">{label}</span>
            <span className="ibx-navitem__count">{n || ''}</span>
          </button>
        )
      })}

      <div className="ibx-sect">Channels</div>
      {CHANNELS.map((c) => {
        const soon = c === 'wechat'
        const on = channel === c
        const n = counts?.channels?.[c]
        return (
          <button key={c} type="button" disabled={soon} title={CHANNEL_META[c].label} className={`ibx-navitem${on ? ' ibx-navitem--on' : ''}`}
            style={soon ? { color: '#94A3B8', cursor: 'default' } : undefined}
            onClick={() => { onTeam(null); onView('all'); onChannel(on ? null : c) }}>
            <span className="ibx-dot" style={{ background: soon ? '#CBD5E1' : CHANNEL_META[c].color, margin: '0 4px' }} />
            <span className="ibx-navitem__text">{CHANNEL_META[c].label}</span>
            <span className="ibx-navitem__count" style={soon ? { fontWeight: 500 } : undefined}>{soon ? 'Soon' : n || ''}</span>
          </button>
        )
      })}

      {counts?.overdue && !collapsed ? (
        <div style={{ marginTop: 'auto', padding: '12px 10px 4px', fontSize: 12.5, color: '#B42318', fontWeight: 500 }}>
          {counts.overdue} overdue {counts.overdue === 1 ? 'reply' : 'replies'}
        </div>
      ) : null}
    </nav>
  )
}

import { CheckCheck, Clock, Inbox, Link2, User } from 'lucide-react'
import type { Channel, InboxCounts, View } from './inboxApi'
import { CHANNEL_META, TEAM_LABEL } from './inboxFormat'

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
]

const CHANNELS: Channel[] = ['whatsapp', 'wechat', 'portal', 'email']
const TEAMS = ['IS', 'IA', 'ES', 'EA']

export default function InboxNav({ counts, view, channel, team, onView, onChannel, onTeam }: Props) {
  const viewCount = (k: View): number | null => {
    if (!counts) return null
    if (k === 'closed') return null
    return counts[k] ?? null
  }
  return (
    <nav className="ibx-nav ibx-pane" aria-label="Inbox views">
      <div className="ibx-nav__head"><h1>Inbox</h1></div>
      {VIEWS.map(({ key, label, icon: Icon }) => {
        const on = view === key && !channel && !team
        const n = viewCount(key)
        return (
          <button key={key} type="button" className={`ibx-navitem${on ? ' ibx-navitem--on' : ''}`}
            onClick={() => { onChannel(null); onTeam(null); onView(key) }}>
            <Icon size={16} strokeWidth={1.8} />{label}
            {n ? <span className={`ibx-navitem__count${key === 'unknown' && !on ? ' ibx-navitem__count--alert' : ''}`}>{n}</span> : null}
          </button>
        )
      })}

      <div className="ibx-sect">Channels</div>
      {CHANNELS.map((c) => {
        const soon = c === 'wechat' || c === 'email'
        const on = channel === c
        const n = counts?.channels?.[c]
        return (
          <button key={c} type="button" disabled={soon} className={`ibx-navitem${on ? ' ibx-navitem--on' : ''}`}
            style={soon ? { color: '#94A3B8', cursor: 'default' } : undefined}
            onClick={() => { onTeam(null); onView('all'); onChannel(on ? null : c) }}>
            <span className="ibx-dot" style={{ background: soon ? '#CBD5E1' : CHANNEL_META[c].color, margin: '0 4px' }} />
            {CHANNEL_META[c].label}
            <span className="ibx-navitem__count" style={soon ? { fontWeight: 500 } : undefined}>{soon ? 'Soon' : n || ''}</span>
          </button>
        )
      })}

      <div className="ibx-sect">Teams</div>
      {TEAMS.map((t) => {
        const on = team === t
        const n = counts?.teams?.[t]
        return (
          <button key={t} type="button" className={`ibx-navitem${on ? ' ibx-navitem--on' : ''}`}
            onClick={() => { onChannel(null); onView('all'); onTeam(on ? null : t) }}>
            {TEAM_LABEL[t]}<span className="ibx-navitem__count">{n || ''}</span>
          </button>
        )
      })}

      {counts?.overdue ? (
        <div style={{ marginTop: 'auto', padding: '12px 10px 4px', fontSize: 12.5, color: '#B42318', fontWeight: 500 }}>
          {counts.overdue} overdue {counts.overdue === 1 ? 'reply' : 'replies'}
        </div>
      ) : null}
    </nav>
  )
}

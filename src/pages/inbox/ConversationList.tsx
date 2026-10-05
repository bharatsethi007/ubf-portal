import { Search } from 'lucide-react'
import type { InboxRow, View } from './inboxApi'
import { avatarColors, CHANNEL_META, initials, slaFor, timeAgo } from './inboxFormat'

type Props = {
  rows: InboxRow[]; loading: boolean; error: string; view: View
  selectedId: string | null; search: string
  onSearch: (q: string) => void; onSelect: (id: string) => void
}

function orgLine(r: InboxRow): string {
  if (r.account_name) return r.account_name
  if (r.contact_type) return `${r.contact_type[0].toUpperCase()}${r.contact_type.slice(1)} · +${r.wa_id ?? ''}`
  return r.wa_id ? `Unknown · +${r.wa_id}` : 'Unknown sender'
}

export default function ConversationList({ rows, loading, error, view, selectedId, search, onSearch, onSelect }: Props) {
  return (
    <section className="ibx-list ibx-pane" aria-label="Conversations">
      <div className="ibx-list__head">
        <label className="ibx-search">
          <Search size={16} strokeWidth={1.8} />
          <input aria-label="Search conversations" placeholder="Search name, booking, message…"
            value={search} onChange={(e) => onSearch(e.target.value)} />
        </label>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          {loading ? 'Loading…' : `${rows.length} ${view === 'closed' ? 'closed' : view === 'snoozed' ? 'snoozed' : 'open'} · most urgent first`}
        </div>
      </div>

      {error ? <div className="ibx-empty" style={{ color: '#B42318' }}>{error}</div> : null}
      {!loading && !error && rows.length === 0 ? <div className="ibx-empty">Nothing here. Inbox zero.</div> : null}

      {rows.map((r) => {
        const unknown = !r.account_id && !r.contact_type
        const sla = view === 'closed' ? null : slaFor(r)
        const ch = r.last_channel ?? r.channels[0] ?? 'portal'
        return (
          <button key={r.id} type="button" className={`ibx-conv${r.id === selectedId ? ' ibx-conv--sel' : ''}`} onClick={() => onSelect(r.id)}>
            <span className="ibx-av" style={avatarColors(r.who, unknown)}>
              {initials(r.who)}
              <span className="ibx-av__badge" style={{ background: CHANNEL_META[ch].color }} title={CHANNEL_META[ch].label} />
            </span>
            <span className="ibx-conv__body">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ibx-ellip" style={{ fontWeight: r.unread ? 700 : 600, fontSize: 14 }}>{r.who}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{timeAgo(r.last_message_at)}</span>
              </span>
              <span className="ibx-ellip" style={{ fontSize: 12.5, color: unknown ? '#B42318' : '#64748B' }}>{orgLine(r)}</span>
              <span className="ibx-ellip" style={{ fontSize: 13, color: '#334155' }}>
                {r.last_sender === 'staff' ? 'You: ' : ''}{r.last_preview ?? r.subject ?? ''}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                {r.booking_ref ? <span className="ibx-chip ibx-mono" style={{ background: '#F1F5F9', color: '#334155' }}>{r.booking_ref}</span> : null}
                {sla ? <span className={`ibx-chip ibx-chip--${sla.tone}`}>{sla.label}</span> : null}
                {r.assignee_name ? (
                  <span className="ibx-chip" style={{ background: '#F4F3FF', color: '#5B21B6' }}>{initials(r.assignee_name)}</span>
                ) : null}
                {r.unread ? <span className="ibx-unread">{r.unread > 99 ? '99+' : r.unread}</span> : null}
              </span>
            </span>
          </button>
        )
      })}
    </section>
  )
}

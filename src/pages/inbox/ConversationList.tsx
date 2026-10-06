import { Search } from 'lucide-react'
import type { InboxRow, View } from './inboxApi'
import { avatarColors, CHANNEL_META, initials, slaFor, timeAgo } from './inboxFormat'

type Props = {
  rows: InboxRow[]; loading: boolean; error: string; view: View
  selectedId: string | null; search: string
  onSearch: (q: string) => void; onSelect: (id: string) => void
}

const SLA_COLOR = { late: '#B42318', due: '#B54708', ok: '#64748B', done: '#067647' } as const

function orgLine(r: InboxRow): string {
  if (r.account_name) return r.account_name
  if (r.contact_type) return r.contact_type[0].toUpperCase() + r.contact_type.slice(1)
  return 'Unknown'
}

export default function ConversationList({ rows, loading, error, view, selectedId, search, onSearch, onSelect }: Props) {
  return (
    <section className="ibx-list ibx-pane" aria-label="Conversations">
      <div className="ibx-list__head">
        <label className="ibx-search">
          <Search size={15} strokeWidth={1.8} />
          <input aria-label="Search conversations" placeholder="Search name, booking, message…"
            value={search} onChange={(e) => onSearch(e.target.value)} />
        </label>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          {loading ? 'Loading…' : `${rows.length} ${view === 'closed' ? 'closed' : view === 'snoozed' ? 'snoozed' : 'open'} · most urgent first`}
        </div>
      </div>

      {error ? <div className="ibx-empty" style={{ color: '#B42318' }}>Could not load. Retrying…</div> : null}
      {!loading && !error && rows.length === 0 ? <div className="ibx-empty">Nothing here. Inbox zero.</div> : null}

      {rows.map((r) => {
        const unknown = !r.account_id && !r.contact_type
        const sla = view === 'closed' ? null : slaFor(r)
        const ch = r.last_channel ?? r.channels[0] ?? 'portal'
        const strong = r.unread > 0
        return (
          <button key={r.id} type="button" className={`ibx-conv${r.id === selectedId ? ' ibx-conv--sel' : ''}`}
            onClick={() => onSelect(r.id)} title={r.booking_ref ?? undefined}>
            <span className="ibx-av ibx-av--md" style={avatarColors(r.who, unknown)}>
              {initials(r.who)}
              <span className="ibx-av__badge" style={{ background: CHANNEL_META[ch].color }} title={CHANNEL_META[ch].label} />
            </span>
            <span className="ibx-conv__body">
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                <span className="ibx-ellip" style={{ fontWeight: strong ? 600 : 500, fontSize: 13.5, flex: '0 1 auto' }}>{r.who}</span>
                <span className="ibx-ellip" style={{ fontSize: 12, color: unknown ? '#B42318' : '#64748B', flex: '1 1 0' }}>{orgLine(r)}</span>
                <span style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap' }}>{timeAgo(r.last_message_at)}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span className="ibx-ellip" style={{ fontSize: 12.5, color: strong ? '#0F172A' : '#475467', flex: 1 }}>
                  {r.last_sender === 'staff' ? 'You: ' : ''}{r.last_preview ?? r.subject ?? ''}
                </span>
                {sla && sla.tone !== 'done' ? (
                  <span style={{ fontSize: 11.5, color: SLA_COLOR[sla.tone], whiteSpace: 'nowrap' }}>{sla.label}</span>
                ) : null}
                {strong ? <span className="ibx-unread">{r.unread > 99 ? '99+' : r.unread}</span> : null}
              </span>
            </span>
          </button>
        )
      })}
    </section>
  )
}

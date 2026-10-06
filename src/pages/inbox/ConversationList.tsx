import { CheckCheck, EyeOff, Search, UserCheck, X } from 'lucide-react'
import type { InboxRow, View } from './inboxApi'
import { avatarColors, CHANNEL_META, initials, slaFor, timeAgo } from './inboxFormat'

type Props = {
  rows: InboxRow[]; loading: boolean; error: string; view: View
  selectedId: string | null; search: string
  onSearch: (q: string) => void; onSelect: (id: string) => void
  picked: Set<string>; onPick: (ids: string[], on: boolean) => void; onBulk: (action: 'close' | 'ignore' | 'assign_me' | 'open') => void
}

function orgLine(r: InboxRow): string {
  if (r.account_name) return r.account_name
  if (r.contact_type) return r.contact_type[0].toUpperCase() + r.contact_type.slice(1)
  return r.contact_email ?? 'Unknown'
}

export default function ConversationList({ rows, loading, error, view, selectedId, search, onSearch, onSelect, picked, onPick, onBulk }: Props) {
  const picking = picked.size > 0
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id))
  return (
    <section className="ibx-list ibx-pane" aria-label="Conversations">
      <div className="ibx-list__head">
        <label className="ibx-search">
          <Search size={15} strokeWidth={1.8} />
          <input aria-label="Search conversations" placeholder="Search name, booking, message…"
            value={search} onChange={(e) => onSearch(e.target.value)} />
        </label>
        {picking ? (
          <div className="ibx-bulk">
            <input type="checkbox" aria-label="Select all" checked={allOn} onChange={(e) => onPick(rows.map((r) => r.id), e.target.checked)} />
            <span style={{ flex: 1 }}>{picked.size} selected</span>
            {view === 'closed' || view === 'ignored' ? (
              <button type="button" className="ibx-mail__icon" title="Reopen" aria-label="Reopen" onClick={() => onBulk('open')}><CheckCheck size={16} /></button>
            ) : (
              <>
                <button type="button" className="ibx-mail__icon" title="Close" aria-label="Close selected" onClick={() => onBulk('close')}><CheckCheck size={16} /></button>
                <button type="button" className="ibx-mail__icon" title="Ignore" aria-label="Ignore selected" onClick={() => onBulk('ignore')}><EyeOff size={16} /></button>
              </>
            )}
            <button type="button" className="ibx-mail__icon" title="Assign to me" aria-label="Assign selected to me" onClick={() => onBulk('assign_me')}><UserCheck size={16} /></button>
            <button type="button" className="ibx-mail__icon" title="Clear selection" aria-label="Clear selection" onClick={() => onPick([...picked], false)}><X size={16} /></button>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {loading ? 'Loading…' : `${rows.length} ${view === 'closed' || view === 'snoozed' || view === 'ignored' ? view : 'open'} · most urgent first`}
          </div>
        )}
      </div>

      {error ? <div className="ibx-empty" style={{ color: '#B42318' }}>Could not load. Retrying…</div> : null}
      {!loading && !error && rows.length === 0 ? <div className="ibx-empty">Nothing here. Inbox zero.</div> : null}

      {rows.map((r) => {
        const unknown = !r.account_id && !r.contact_type
        const sla = view === 'closed' || view === 'ignored' ? null : slaFor(r)
        const ch = r.last_channel ?? r.channels[0] ?? 'portal'
        const strong = r.unread > 0
        return (
          <div key={r.id} className={`ibx-conv${r.id === selectedId ? ' ibx-conv--sel' : ''}${picking ? ' ibx-conv--picking' : ''}${picked.has(r.id) ? ' ibx-conv--picked' : ''}`}>
            <label className="ibx-pick" title="Select">
              <input type="checkbox" aria-label={`Select ${r.who}`} checked={picked.has(r.id)} onChange={(e) => onPick([r.id], e.target.checked)} />
              <span className="ibx-av ibx-av--md" style={avatarColors(r.who, unknown)}>
                {initials(r.who)}
                <span className="ibx-av__badge" style={{ background: CHANNEL_META[ch].color }} title={CHANNEL_META[ch].label} />
              </span>
            </label>
            <button type="button" className="ibx-conv__main" onClick={() => onSelect(r.id)} title={r.booking_ref ?? undefined}>
            <span className="ibx-conv__body">
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                <span className="ibx-ellip" style={{ fontWeight: strong ? 600 : 500, fontSize: 13.5, flex: '0 1 auto' }}>{r.who}</span>
                {unknown
                  ? <span className="ibx-pill ibx-chip--late" style={{ flex: 'none' }}>Unknown</span>
                  : <span className="ibx-ellip" style={{ fontSize: 12, color: '#64748B', flex: '1 1 0' }}>{orgLine(r)}</span>}
                {unknown ? <span style={{ flex: 1 }} /> : null}
                <span style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap' }}>{timeAgo(r.last_message_at)}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span className="ibx-ellip" style={{ fontSize: 12.5, color: strong ? '#0F172A' : '#475467', flex: 1 }}>
                  {r.last_sender === 'staff' ? 'You: ' : ''}{r.last_preview ?? r.subject ?? ''}
                </span>
                {sla && sla.tone !== 'done' ? <span className={`ibx-pill ibx-chip--${sla.tone}`}>{sla.label}</span> : null}
                {strong ? <span className="ibx-unread">{r.unread > 99 ? '99+' : r.unread}</span> : null}
              </span>
            </span>
            </button>
          </div>
        )
      })}
    </section>
  )
}

import { fmtRelative } from '../../utils/relativeTime'
import type { WhatsAppConversation } from './whatsappInboxApi'

type Props = {
  conversations: WhatsAppConversation[]
  activeTab: string
  selectedId: string | null
  onSelect: (id: string) => void
}

function snippet(c: WhatsAppConversation): string {
  const body = (c.last_body ?? '').trim()
  if (!body) return '—'
  const prefix = c.last_direction === 'outbound' ? 'You: ' : ''
  const text = prefix + body
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
}

export default function ConversationList({ conversations, activeTab: _activeTab, selectedId, onSelect }: Props) {
  if (!conversations.length) {
    return <div className="wa-inbox-list__empty">No conversations in this view.</div>
  }

  return (
    <ul className="wa-inbox-list">
      {conversations.map((c) => {
        const id = c.contact_id
        const on = selectedId === id
        return (
          <li key={id}>
            <button type="button" className={`wa-inbox-row${on ? ' wa-inbox-row--on' : ''}`} onClick={() => onSelect(id)}>
              <div className="wa-inbox-row__top">
                <span className="wa-inbox-row__name">
                  {c.account_name ?? c.wa_id}
                  {!c.verified ? <span className="wa-inbox-chip wa-inbox-chip--muted">Unverified</span> : null}
                </span>
                <span className="wa-inbox-row__time">{fmtRelative(c.last_at)}</span>
              </div>
              <div className="wa-inbox-row__bottom">
                <span className="wa-inbox-row__snippet">{snippet(c)}</span>
                {c.needs_action_count > 0 ? (
                  <span className="wa-inbox-row__badge" title={`${c.needs_action_count} need action`}>
                    <span className="wa-inbox-row__dot" aria-hidden />
                    {c.needs_action_count}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

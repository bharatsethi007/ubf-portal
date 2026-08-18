import { useCallback, useEffect, useMemo, useState } from 'react'
import ConversationList from './ConversationList'
import MessageThread from './MessageThread'
import { listConversations, type WhatsAppConversation } from './whatsappInboxApi'

type Tab = 'all' | 'needs_action' | 'tracking' | 'bookings' | 'quotes'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_action', label: 'Needs action' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'quotes', label: 'Quotes' },
]

function filterTab(rows: WhatsAppConversation[], tab: Tab): WhatsAppConversation[] {
  switch (tab) {
    case 'needs_action': return rows.filter((c) => (c.needs_action_count ?? 0) > 0)
    case 'tracking': return rows.filter((c) => c.has_tracking)
    case 'bookings': return rows.filter((c) => c.has_booking)
    case 'quotes': return rows.filter((c) => c.has_quote)
    default: return rows
  }
}

export default function WhatsAppInboxPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [rows, setRows] = useState<WhatsAppConversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const data = await listConversations()
      setRows(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load conversations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  useEffect(() => {
    const id = window.setInterval(() => { void reload() }, 30_000)
    return () => window.clearInterval(id)
  }, [reload])

  const filtered = useMemo(() => filterTab(rows, tab), [rows, tab])

  useEffect(() => {
    if (!filtered.length) { setSelectedId(null); return }
    if (!selectedId || !filtered.some((c) => c.contact_id === selectedId)) {
      setSelectedId(filtered[0].contact_id)
    }
  }, [filtered, selectedId])

  const selected = filtered.find((c) => c.contact_id === selectedId) ?? null

  return (
    <div className="wa-inbox-page">
      <header className="wa-inbox-page__head">
        <h1 className="wa-inbox-page__title">WhatsApp Inbox</h1>
        <div className="wa-inbox-tabs" role="tablist" aria-label="Filter conversations">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`wa-inbox-tabs__btn${tab === key ? ' wa-inbox-tabs__btn--on' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="wa-inbox-layout">
        <aside className="wa-inbox-layout__list card">
          {loading && !rows.length ? (
            <p className="wa-inbox-list__empty">Loading conversations…</p>
          ) : (
            <ConversationList
              conversations={filtered}
              activeTab={tab}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </aside>
        <section className="wa-inbox-layout__thread card">
          <MessageThread contactId={selectedId} conversation={selected} onSent={() => void reload()} />
        </section>
      </div>
    </div>
  )
}

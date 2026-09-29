import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StaffConversation from './StaffConversation'
import { listStaffThreads, TEAM, when, type StaffThread } from './portalMessagesApi'

type Status = 'open' | 'closed' | 'all'
const TEAMS = ['all', 'IS', 'ES', 'IA', 'EA', 'general'] as const
type Team = (typeof TEAMS)[number]

/** Console inbox for customer portal messages. Waiting = last message is from the customer. */
export default function PortalMessagesInbox() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('t')
  const [status, setStatus] = useState<Status>('open')
  const [team, setTeam] = useState<Team>('all')
  const [rows, setRows] = useState<StaffThread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try { setRows(await listStaffThreads(status)); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load') }
    finally { setLoading(false) }
  }, [status])

  useEffect(() => { void reload() }, [reload])
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void reload() }, 30_000)
    return () => window.clearInterval(id)
  }, [reload])

  const shown = useMemo(() => rows.filter((r) => team === 'all' || (team === 'general' ? !r.module : r.module === team)), [rows, team])
  const waiting = (r: StaffThread) => r.status === 'open' && r.last_sender === 'customer'

  return (
    <div className="wa-inbox-page">
      <header className="wa-inbox-page__head">
        <h1 className="wa-inbox-page__title">Portal Messages</h1>
        <div className="wa-inbox-tabs" role="tablist" aria-label="Status">
          {(['open', 'closed', 'all'] as Status[]).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s}
              className={`wa-inbox-tabs__btn${status === s ? ' wa-inbox-tabs__btn--on' : ''}`} onClick={() => setStatus(s)}>
              {s === 'open' ? 'Open' : s === 'closed' ? 'Closed' : 'All'}
            </button>
          ))}
          <select className="input input--sm" style={{ width: 'auto', marginLeft: 8 }} value={team} onChange={(e) => setTeam(e.target.value as Team)} aria-label="Team">
            {TEAMS.map((t) => <option key={t} value={t}>{t === 'all' ? 'All teams' : t === 'general' ? 'General' : TEAM[t]}</option>)}
          </select>
        </div>
      </header>

      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="wa-inbox-layout">
        <aside className="wa-inbox-layout__list card">
          {loading && !rows.length ? <p className="wa-inbox-list__empty">Loading…</p> : !shown.length ? (
            <div className="wa-inbox-list__empty">No conversations in this view.</div>
          ) : (
            <ul className="wa-inbox-list">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`wa-inbox-row${selected === r.id ? ' wa-inbox-row--on' : ''}`} onClick={() => setParams({ t: r.id })}>
                    <div className="wa-inbox-row__top">
                      <span className="wa-inbox-row__name">
                        {r.customer ?? r.account_id}
                        {waiting(r) ? <span className="wa-inbox-chip wa-inbox-chip--warn" style={{ marginLeft: 6 }}>Waiting</span> : null}
                      </span>
                      <span className="wa-inbox-row__time">{when(r.last_message_at)}</span>
                    </div>
                    <div className="wa-inbox-row__bottom">
                      <span className="wa-inbox-row__snippet"><b>{r.subject}</b> · {r.last_sender === 'staff' ? 'You: ' : ''}{r.last_preview}</span>
                      {r.unread > 0 ? <span className="wa-inbox-row__badge"><span className="wa-inbox-row__dot" aria-hidden />{r.unread}</span> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="wa-inbox-layout__thread card">
          <StaffConversation threadId={selected} onChanged={() => void reload()} />
        </section>
      </div>
    </div>
  )
}

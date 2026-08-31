import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listFreightNetworks, type FreightNetwork } from '../agentsApi'
import { formatConferenceDateRange } from './conferenceDates'
import {
  conferenceBucket,
  listConferences,
  type ConferenceCard,
} from './conferencesApi'
import NewConferenceModal from './NewConferenceModal'
import './conferences.css'

type View = 'active' | 'past'

const VIEW_TABS: { key: View; label: string }[] = [
  { key: 'active', label: 'Current & Upcoming' },
  { key: 'past', label: 'Past' },
]

export default function ConferencesHub() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('active')
  const [conferences, setConferences] = useState<ConferenceCard[]>([])
  const [networks, setNetworks] = useState<FreightNetwork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listConferences(), listFreightNetworks()])
      .then(([rows, nets]) => {
        if (cancelled) return
        setConferences(rows)
        setNetworks(nets)
        setError('')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message ?? 'Failed to load conferences')
        setConferences([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => {
    const current: ConferenceCard[] = []
    const upcoming: ConferenceCard[] = []
    const past: ConferenceCard[] = []
    for (const c of conferences) {
      const b = conferenceBucket(c)
      if (b === 'current') current.push(c)
      else if (b === 'upcoming') upcoming.push(c)
      else past.push(c)
    }
    const byStartAsc = (a: ConferenceCard, b: ConferenceCard) =>
      a.start_date.localeCompare(b.start_date)
    current.sort(byStartAsc)
    upcoming.sort(byStartAsc)
    // past stays newest-first (listConferences orders start_date desc)
    return { current, upcoming, past }
  }, [conferences])

  const counts: Record<View, number> = {
    active: groups.current.length + groups.upcoming.length,
    past: groups.past.length,
  }

  const renderCard = (c: ConferenceCard, featured = false) => (
    <div
      key={c.id}
      className={`conference-card${featured ? ' conference-card--featured' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/agents/conferences/${c.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/agents/conferences/${c.id}`)
        }
      }}
    >
      <div className="conference-card__banner">
        {c.cover_image_url ? <img src={c.cover_image_url} alt="" /> : c.network_code ?? '—'}
      </div>
      <div className="conference-card__body">
        <div className="conference-card__name">{c.name}</div>
        {c.network_code && <span className="conference-card__chip">{c.network_code}</span>}
        <div className="conference-card__meta">
          {formatConferenceDateRange(c.start_date, c.end_date)}
        </div>
        <div className="conference-card__meta">
          {c.meeting_count} meetings · {c.default_meeting_minutes}m default
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="conferences-hub__head">
        <button type="button" className="btn quotes-page__new-btn" onClick={() => setShowNew(true)}>
          <Plus size={16} strokeWidth={2} />
          New conference
        </button>
      </div>

      <div
        className="customers-segment conferences-hub__tabs"
        role="group"
        aria-label="Conference period"
      >
        {VIEW_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`customers-segment__btn${view === key ? ' customers-segment__btn--on' : ''}`}
            onClick={() => setView(key)}
          >
            <span className="conferences-hub__tab-label">
              {label}
              <span className="agent-review-count-chip">{counts[key]}</span>
            </span>
          </button>
        ))}
      </div>

      {error && <div className="error card pad-inline">{error}</div>}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : view === 'past' ? (
        groups.past.length === 0 ? (
          <p className="text-muted-foreground">No past conferences.</p>
        ) : (
          <div className="conference-grid">{groups.past.map((c) => renderCard(c))}</div>
        )
      ) : counts.active === 0 ? (
        <p className="text-muted-foreground">No current or upcoming conferences.</p>
      ) : (
        <>
          {groups.current.length > 0 && (
            <section className="conferences-section">
              <h2 className="conferences-section__title">Current</h2>
              <div className="conference-grid conference-grid--featured">
                {groups.current.map((c) => renderCard(c, true))}
              </div>
            </section>
          )}
          {groups.upcoming.length > 0 && (
            <section className="conferences-section">
              <h2 className="conferences-section__title">Upcoming</h2>
              <div className="conference-grid">{groups.upcoming.map((c) => renderCard(c))}</div>
            </section>
          )}
        </>
      )}

      {showNew && (
        <NewConferenceModal
          networks={networks}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            navigate(`/agents/conferences/${id}`)
          }}
        />
      )}
    </>
  )
}

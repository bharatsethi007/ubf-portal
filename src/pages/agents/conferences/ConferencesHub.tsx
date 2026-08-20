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

type Bucket = 'current' | 'upcoming' | 'past'

const BUCKET_TABS: { key: Bucket; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
]

export default function ConferencesHub() {
  const navigate = useNavigate()
  const [bucket, setBucket] = useState<Bucket>('current')
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

  const bucketCounts = useMemo(() => {
    const counts: Record<Bucket, number> = { current: 0, upcoming: 0, past: 0 }
    for (const c of conferences) {
      counts[conferenceBucket(c)] += 1
    }
    return counts
  }, [conferences])

  const filtered = useMemo(
    () => conferences.filter((c) => conferenceBucket(c) === bucket),
    [conferences, bucket],
  )

  return (
    <>
      <div className="conferences-hub__head">
        <button type="button" className="btn quotes-page__new-btn" onClick={() => setShowNew(true)}>
          <Plus size={16} strokeWidth={2} />
          New conference
        </button>
      </div>

      <div className="customers-segment conferences-hub__tabs" role="group" aria-label="Conference period">
        {BUCKET_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`customers-segment__btn${bucket === key ? ' customers-segment__btn--on' : ''}`}
            onClick={() => setBucket(key)}
          >
            <span className="conferences-hub__tab-label">
              {label}
              <span className="agent-review-count-chip">{bucketCounts[key]}</span>
            </span>
          </button>
        ))}
      </div>

      {error && <div className="error card pad-inline">{error}</div>}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No {bucket} conferences.</p>
      ) : (
        <div className="conference-grid">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="conference-card"
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
                {c.cover_image_url ? (
                  <img src={c.cover_image_url} alt="" />
                ) : (
                  c.network_code ?? '—'
                )}
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
          ))}
        </div>
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

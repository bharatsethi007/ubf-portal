import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapPin, Monitor, Settings, Smartphone } from 'lucide-react'
import { formatConferenceDateRange } from './conferenceDates'
import { conferenceDays, dayTabLabel, defaultActiveDay } from './conferenceDays'
import ConferenceDaySchedule from './ConferenceDaySchedule'
import ConferencePhotos from './ConferencePhotos'
import ConferenceSettingsPanel from './ConferenceSettingsPanel'
import {
  fetchConference,
  fetchConferenceStats,
  listConferencePhotos,
  type ConferenceDetail,
  type ConferencePhoto,
  type ConferenceStats,
  type ViewMode,
} from './conferencesApi'
import { useViewMode } from './useViewMode'
import './conferenceRecord.css'

const TAB_KEY = 'ubf.agents.activeTab'

function ViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  return (
    <div className="conf-viewseg" role="group" aria-label="View mode">
      <button
        type="button"
        className={`conf-viewseg__btn${viewMode === 'desktop' ? ' conf-viewseg__btn--on' : ''}`}
        onClick={() => onChange('desktop')}
      >
        <Monitor size={14} />
        Desktop
      </button>
      <button
        type="button"
        className={`conf-viewseg__btn${viewMode === 'mobile' ? ' conf-viewseg__btn--on' : ''}`}
        onClick={() => onChange('mobile')}
      >
        <Smartphone size={14} />
        Mobile
      </button>
    </div>
  )
}

function ConferenceStatsRow({
  stats,
  viewMode,
}: {
  stats: ConferenceStats
  viewMode: ViewMode
}) {
  if (viewMode === 'mobile') {
    return (
      <div className="conf-stats--compact">
        {stats.total_meetings} meetings · {stats.agents_met} met · {stats.agents_revisited}{' '}
        revisited
      </div>
    )
  }
  return (
    <div className="conf-stats">
      <div className="conf-stat">
        <div className="conf-stat__num">{stats.total_meetings}</div>
        <div className="conf-stat__label">Total meetings</div>
      </div>
      <div className="conf-stat">
        <div className="conf-stat__num">{stats.agents_met}</div>
        <div className="conf-stat__label">Agents met</div>
      </div>
      <div className="conf-stat">
        <div className="conf-stat__num">{stats.agents_revisited}</div>
        <div className="conf-stat__label">Agents revisited</div>
      </div>
    </div>
  )
}

export default function ConferenceRecordPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { viewMode, setMode, ready } = useViewMode()
  const [conference, setConference] = useState<ConferenceDetail | null>(null)
  const [photos, setPhotos] = useState<ConferencePhoto[]>([])
  const [stats, setStats] = useState<ConferenceStats>({
    total_meetings: 0,
    agents_met: 0,
    agents_revisited: 0,
  })
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const loadPhotos = useCallback(async (conferenceId: string) => {
    const rows = await listConferencePhotos(conferenceId)
    setPhotos(rows)
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [conf, statRows] = await Promise.all([
        fetchConference(id),
        fetchConferenceStats(id),
      ])
      setConference(conf)
      setStats(statRows)
      if (conf) {
        setActiveDay(defaultActiveDay(conf.start_date, conf.end_date))
        await loadPhotos(conf.id)
      }
    } finally {
      setLoading(false)
    }
  }, [id, loadPhotos])

  useEffect(() => {
    void load()
  }, [load])

  const days = useMemo(
    () => (conference ? conferenceDays(conference.start_date, conference.end_date) : []),
    [conference],
  )

  const activeDayIndex = days.indexOf(activeDay)

  function goBack() {
    try {
      localStorage.setItem(TAB_KEY, 'conferences')
    } catch {
      /* ignore */
    }
    navigate('/agents')
  }

  if (loading || !ready) return <div className="detail-page pad">Loading…</div>
  if (!conference) {
    return (
      <div className="detail-page pad">
        Conference not found.{' '}
        <button type="button" className="text-link" onClick={goBack}>
          Back to conferences
        </button>
      </div>
    )
  }

  const isMobile = viewMode === 'mobile'

  return (
    <div className="detail-page">
      <header className="cp-header">
        <button type="button" className="detail-back" onClick={goBack}>
          ← Conferences
        </button>

        <div
          className={`conf-header-band${isMobile ? ' conf-header-band--mobile' : ''}`}
          style={conference.header_image_url ? undefined : { background: '#0A2472' }}
        >
          {conference.header_image_url && (
            <img
              className="conf-header-band__img"
              src={conference.header_image_url}
              alt=""
            />
          )}
          <div className="conf-header-band__overlay">{conference.name}</div>
        </div>

        <div className="conf-record-title-row">
          <div>
            <h1 className="cp-title">{conference.name}</h1>
            <div className="conf-record-meta">
              {conference.network_code && (
                <span className="cp-badge cp-badge--indigo">{conference.network_code}</span>
              )}
              <span>{formatConferenceDateRange(conference.start_date, conference.end_date)}</span>
              {conference.location_name && (
                <span className="conf-record-location">
                  <MapPin size={14} />
                  {conference.location_name}
                </span>
              )}
            </div>
          </div>
          <div className="conf-record-head-actions">
            {!isMobile && (
              <button
                type="button"
                className="btn btn--inline"
                onClick={() => setShowSettings((v) => !v)}
              >
                <Settings size={16} />
                Settings
              </button>
            )}
            <ViewModeToggle viewMode={viewMode} onChange={setMode} />
          </div>
        </div>

        <ConferenceStatsRow stats={stats} viewMode={viewMode} />

        <div className="conf-daytabs-scroll">
          <div className="cp-tabs">
            {days.map((day, i) => (
              <button
                key={day}
                type="button"
                className={`cp-tab${activeDay === day ? ' cp-tab--active' : ''}`}
                onClick={() => setActiveDay(day)}
              >
                {dayTabLabel(day, i)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="cp-body">
        {showSettings && !isMobile && (
          <ConferenceSettingsPanel
            conference={conference}
            onUpdated={(patch) => setConference((c) => (c ? { ...c, ...patch } : c))}
          />
        )}

        <ConferenceDaySchedule
          conferenceId={conference.id}
          day={activeDay}
          dayIndex={activeDayIndex >= 0 ? activeDayIndex : 0}
          viewMode={viewMode}
          defaultMinutes={conference.default_meeting_minutes}
        />

        <ConferencePhotos
          conferenceId={conference.id}
          photos={photos}
          viewMode={viewMode}
          onReload={() => void loadPhotos(conference.id)}
        />
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useJobsReference } from '../../hooks/useJobsReference'
import {
  formatRefDate,
  isSameLane,
  statusTone,
  type ReferenceJob,
} from './jobsReferenceApi'
import './suggestionBubble.css'

type Props = {
  shipperAccountId?: string
  consigneeAccountId?: string
  origin?: string
  destination?: string
  module?: string
  onCopyCargo: (job: ReferenceJob) => void
}

function jobCargoSummary(job: ReferenceJob): string {
  return [
    job.goods_desc,
    job.pack_qty != null ? `${job.pack_qty} ${job.pack_type ?? ''}`.trim() : null,
    job.weight_kg != null ? `${job.weight_kg} kg` : null,
  ].filter(Boolean).join(' · ')
}

function SuggestionJobCard({ job, onCopy }: { job: ReferenceJob; onCopy: () => void }) {
  const tone = statusTone(job.status)
  const lane = [job.origin, job.destination].filter(Boolean).join(' → ') || '—'
  const cargo = jobCargoSummary(job)

  return (
    <article className="suggestion-job">
      <div className="suggestion-job__top">
        <span className="suggestion-job__bill mono">{job.house_bill || '—'}</span>
        <span className={`suggestion-job__status suggestion-job__status--${tone}`}>
          {job.status || 'Unknown'}
        </span>
      </div>
      <div className="suggestion-job__lane mono">{lane}</div>
      <div className="suggestion-job__meta muted">
        {formatRefDate(job.relevant_date)}
        {job.vessel_flight ? ` · ${job.vessel_flight}` : ''}
        {isSameLane(job) ? ' · Same lane' : ''}
      </div>
      {cargo && <div className="suggestion-job__cargo muted">{cargo}</div>}
      <button type="button" className="suggestion-job__copy" onClick={onCopy}>
        Copy cargo to booking
      </button>
    </article>
  )
}

export default function SuggestionBubble({
  shipperAccountId,
  consigneeAccountId,
  origin,
  destination,
  module,
  onCopyCargo,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const [pulse, setPulse] = useState(false)
  const prevCount = useRef(0)

  const { jobs, loading, error, ready, count } = useJobsReference({
    shipperAccountId,
    consigneeAccountId,
    origin,
    destination,
    module,
  })

  const hasSuggestions = ready && !loading && count > 0

  useEffect(() => {
    if (loading || !ready) return
    if (count > 0 && count !== prevCount.current) {
      setPulse(true)
      const t = window.setTimeout(() => setPulse(false), 700)
      prevCount.current = count
      return () => window.clearTimeout(t)
    }
    prevCount.current = count
  }, [count, loading, ready])

  function handleCopy(job: ReferenceJob) {
    onCopyCargo(job)
    setOpen(false)
  }

  if (collapsed) {
    return (
      <button type="button" className="suggestion-bubble__tab" onClick={() => setCollapsed(false)}>
        AI
      </button>
    )
  }

  return (
    <div className="suggestion-bubble-root">
      {open && (
        <div className="suggestion-popover" role="dialog" aria-label="Job suggestions">
          <div className="suggestion-popover__head">
            <div className="suggestion-popover__head-main">
              <h3 className="suggestion-popover__title">Recent jobs for this shipper</h3>
              {hasSuggestions && <span className="suggestion-popover__count">{count}</span>}
            </div>
            <button type="button" className="suggestion-popover__close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="suggestion-popover__body">
            {!ready && (
              <p className="suggestion-popover__empty muted">
                Select shipper or consignee, origin, and destination to see suggestions.
              </p>
            )}
            {ready && loading && (
              <>
                <div className="suggestion-popover__skel" />
                <div className="suggestion-popover__skel" />
              </>
            )}
            {ready && !loading && error && (
              <p className="suggestion-popover__empty bf-field__error">{error}</p>
            )}
            {ready && !loading && !error && count === 0 && (
              <p className="suggestion-popover__empty muted">No suggestions yet.</p>
            )}
            {ready && !loading && !error && jobs.map((job, i) => (
              <SuggestionJobCard
                key={job.job_unique ?? job.house_bill ?? i}
                job={job}
                onCopy={() => handleCopy(job)}
              />
            ))}
          </div>
        </div>
      )}

      <div className={`suggestion-bubble${hasSuggestions ? ' suggestion-bubble--active' : ''}${pulse ? ' suggestion-bubble--pulse' : ''}`}>
        <button type="button" className="suggestion-bubble__dismiss" onClick={() => setCollapsed(true)} aria-label="Dismiss assistant">
          ×
        </button>
        <button
          type="button"
          className="suggestion-bubble__btn"
          onClick={() => setOpen((v) => !v)}
          aria-label={hasSuggestions ? `${count} job suggestions` : 'Job suggestions'}
        >
          {hasSuggestions && <span className="suggestion-bubble__ring" aria-hidden />}
          <Sparkles size={22} className="suggestion-bubble__icon" />
          {hasSuggestions && <span className="suggestion-bubble__badge">{count}</span>}
        </button>
      </div>
    </div>
  )
}

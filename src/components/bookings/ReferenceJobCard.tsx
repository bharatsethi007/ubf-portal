import { formatRefDate, isSameLane, statusTone, type ReferenceJob } from './jobsReferenceApi'

type Props = {
  job: ReferenceJob
  onClick: () => void
}

export default function ReferenceJobCard({ job, onClick }: Props) {
  const tone = statusTone(job.status)
  const lane = [job.origin, job.destination].filter(Boolean).join(' → ') || '—'
  const cargo = [
    job.goods_desc,
    job.pack_qty != null ? `${job.pack_qty} ${job.pack_type ?? ''}`.trim() : null,
    job.weight_kg != null ? `${job.weight_kg} kg` : null,
  ].filter(Boolean).join(' · ')

  return (
    <button type="button" className="bf-ref-card" onClick={onClick}>
      <div className="bf-ref-card__top">
        <span className="bf-ref-card__bill mono">{job.house_bill || '—'}</span>
        <span className={`bf-ref-card__status bf-ref-card__status--${tone}`}>{job.status || 'Unknown'}</span>
      </div>
      <div className="bf-ref-card__lane mono">{lane}</div>
      <div className="bf-ref-card__meta muted">
        {formatRefDate(job.relevant_date)}
        {job.vessel_flight ? ` · ${job.vessel_flight}` : ''}
      </div>
      {cargo && <div className="bf-ref-card__cargo muted">{cargo}</div>}
      {isSameLane(job) && <span className="bf-ref-card__tag">Same lane</span>}
    </button>
  )
}

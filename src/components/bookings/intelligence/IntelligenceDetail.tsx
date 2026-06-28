import { useNavigate } from 'react-router-dom'
import type { IntelligenceJob } from './types'
import { formatIntelDate, modeIcon } from './intelligenceUtils'

type Props = {
  job: IntelligenceJob
  onBack: () => void
}

export default function IntelligenceDetail({ job, onBack }: Props) {
  const navigate = useNavigate()

  return (
    <div className="intel-detail">
      <button type="button" className="intel-detail__back" onClick={onBack}>
        ← Back to insights
      </button>
      <div className="intel-detail__head">
        <span className="intel-detail__icon">{modeIcon(job.mode)}</span>
        <h3 className="intel-detail__title">{job.job}</h3>
      </div>
      <div className="intel-detail__rows">
        {[
          ['Route', job.route || '—'],
          ['ETD', formatIntelDate(job.etd)],
          ['ETA', formatIntelDate(job.eta)],
          ['Date', formatIntelDate(job.date)],
        ].map(([label, value]) => (
          <div key={label} className="intel-detail__row">
            <span className="intel-detail__key">{label}</span>
            <span className="intel-detail__val">{value}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="intel-cta"
        onClick={() => navigate(`/shipments/${encodeURIComponent(job.job)}`)}
      >
        Open full shipment
      </button>
    </div>
  )
}

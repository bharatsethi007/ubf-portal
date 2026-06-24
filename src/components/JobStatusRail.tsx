import type { Shipment } from '../types/shipment'
import { fmtProgress } from '../utils/format'

const STEPS = [
  { label: 'Booked', date: (s: Shipment) => s.doc_date },
  { label: 'Scheduled', date: (s: Shipment) => s.etd },
  { label: 'In transit', date: (s: Shipment) => s.departed },
  { label: 'Arrived', date: (s: Shipment) => s.arrived ?? s.eta },
] as const

function currentStep(status: string): number {
  if (status.startsWith('Arrived')) return 3
  if (status === 'In transit') return 2
  if (status === 'Scheduled') return 1
  return 0
}

export default function JobStatusRail({ shipment }: { shipment: Shipment }) {
  const step = currentStep(shipment.status)
  const fillPct = step <= 0 ? 0 : step >= 3 ? 100 : (step / 3) * 100

  return (
    <div className="job-status-rail">
      <div className="job-status-rail__track" aria-hidden="true">
        <div className="job-status-rail__fill" style={{ width: `${fillPct}%` }} />
        <div className="job-status-rail__dots">
          {STEPS.map((s, i) => (
            <span
              key={s.label}
              className={`job-status-rail__dot${i <= step ? ' done' : ''}${i === step ? ' current' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="job-status-rail__labels">
        {STEPS.map((s, i) => (
          <div key={s.label} className={`job-status-rail__label${i <= step ? ' done' : ''}${i === step ? ' current' : ''}`}>
            <strong>{s.label}</strong>
            <span className="mono">{fmtProgress(s.date(shipment))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

import type { Shipment } from '../types/shipment'
import { fmtProgress } from '../utils/format'
import { progressStep } from '../utils/status'

const STEPS = [
  { key: 'confirmed', label: 'Confirmed', date: (s: Shipment) => s.doc_date },
  { key: 'transit', label: 'In Transit', date: (s: Shipment) => s.departed ?? s.etd },
  { key: 'eta', label: 'ETA', date: (s: Shipment) => s.arrived ?? s.eta },
] as const

export default function ShipmentProgressBar({ shipment }: { shipment: Shipment }) {
  const step = progressStep(shipment.status)
  const fillPct = step <= 0 ? 0 : step >= 2 ? 100 : 50

  return (
    <div className="shipment-progress card">
      <div className="shipment-progress__track" aria-hidden="true">
        <div className="shipment-progress__fill" style={{ width: `${fillPct}%` }} />
        <div className="shipment-progress__dots">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`shipment-progress__dot${i <= step ? ' done' : ''}${i === step ? ' current' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="shipment-progress__labels">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`shipment-progress__label${i <= step ? ' done' : ''}`}>
            <strong>{s.label}</strong>
            <span className="mono">{fmtProgress(s.date(shipment))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

import { Check } from 'lucide-react'
import type { Shipment } from '../types/shipment'
import { fmtDate } from '../utils/format'
import { deriveTrackingEvents } from '../utils/tracking'

export default function TrackingHistoryCard({ shipment }: { shipment: Shipment }) {
  const events = deriveTrackingEvents(shipment)

  return (
    <section className="card tracking-history">
      <h2>Tracking History</h2>
      <ul className="timeline">
        {events.map((ev) => (
          <li key={ev.label} className={`timeline-item timeline-item--${ev.state}`}>
            <span className="timeline-marker">
              {ev.state === 'done' && <Check size={10} strokeWidth={3} />}
            </span>
            <div>
              <strong>{ev.label}</strong>
              {ev.date && <p className="mono muted">{fmtDate(ev.date, true)}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

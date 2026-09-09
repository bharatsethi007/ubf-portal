import type { CourierTrackEvent } from './courierBookingsApi'
import {
  fmtTrackTimestamp,
  normalizeTrackEvent,
  sortTrackEventsNewestFirst,
} from './courierTrackingUtils'

type Props = {
  events: CourierTrackEvent[]
  busy?: boolean
}

export default function CourierTrackingPanel({ events, busy }: Props) {
  const rows = sortTrackEventsNewestFirst(events.map(normalizeTrackEvent))
  if (!rows.length && !busy) return null

  return (
    <section className="card booking-form-card cbd-tracking">
      <h3 className="booking-form-card__title">Tracking</h3>
      <div className="booking-form-card__body">
        {busy && rows.length === 0 ? <p className="muted cbd-tracking__busy">Tracking…</p> : null}
        {rows.length > 0 ? (
          <ul className="cbd-tracking__list">
            {rows.map((ev, i) => (
              <li key={i} className="cbd-tracking__item">
                <span className="cbd-tracking__time">{fmtTrackTimestamp(ev.timestamp)}</span>
                <span className="cbd-tracking__sep">—</span>
                <span className="cbd-tracking__desc">{ev.description}</span>
                <span className="cbd-tracking__sep">—</span>
                <span className="cbd-tracking__loc">{ev.location}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

import { Check } from 'lucide-react'
import { fmtDate } from '@/utils/format'
import type { BookingMilestone } from './bookingTrackingMilestones'

type Props = {
  milestones: BookingMilestone[]
  emptyNote?: string
}

/** Staff timeline — same states as portal TrackingTimeline, uses index.css `.timeline` styles. */
export default function MilestoneTimeline({ milestones, emptyNote }: Props) {
  return (
    <div className="booking-milestone-timeline">
      {emptyNote ? <p className="booking-milestone-timeline__note muted">{emptyNote}</p> : null}
      <ol className="timeline booking-milestone-timeline__list">
        {milestones.map((m) => (
          <li
            key={m.key}
            className={`timeline-item timeline-item--${m.state === 'pending' ? 'upcoming' : m.state}`}
          >
            <span className="timeline-marker">
              {m.state === 'done' ? <Check size={10} strokeWidth={3} /> : null}
            </span>
            <div>
              <strong>{m.label}</strong>
              {m.date ? <p className="mono muted">{fmtDate(m.date, true)}</p> : null}
              {m.source ? <span className="booking-milestone-timeline__source">{m.source}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

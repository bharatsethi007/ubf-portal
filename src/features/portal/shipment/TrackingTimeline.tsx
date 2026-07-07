import { formatShortDate } from '../dashboard/portalFormat'
import type { TimelineMilestone } from './portalShipmentDetailTypes'

type Props = {
  milestones: TimelineMilestone[]
  compact?: boolean
  note?: string
}

export default function TrackingTimeline({ milestones, compact, note }: Props) {
  return (
    <div className={`portal-timeline${compact ? ' portal-timeline--compact' : ''}`}>
      {note && !compact && (
        <p className="portal-timeline__note">{note}</p>
      )}
      <ol className="portal-timeline__list">
        {milestones.map((m) => (
          <li key={m.key} className={`portal-timeline__item portal-timeline__item--${m.state}`}>
            <span className="portal-timeline__dot" aria-hidden />
            <div className="portal-timeline__body">
              <div className="portal-timeline__label">{m.label}</div>
              {m.date && (
                <div className="portal-timeline__date nums">
                  {formatShortDate(m.date)}
                  {m.estimated && <span className="portal-timeline__est"> · estimated</span>}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

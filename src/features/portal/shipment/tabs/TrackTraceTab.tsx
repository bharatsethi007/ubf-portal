import TrackingTimeline from '../TrackingTimeline'
import type { TimelineMilestone } from '../portalShipmentDetailTypes'

const TIMELINE_NOTE =
  'Live milestone tracking (PortConnect, vessel position) is coming. This view is derived from booked, ETD/ETA, and arrival dates until tracking events are synced.'

type Props = { timeline: TimelineMilestone[] }

export default function TrackTraceTab({ timeline }: Props) {
  return (
    <TrackingTimeline
      milestones={timeline}
      note={TIMELINE_NOTE}
    />
  )
}

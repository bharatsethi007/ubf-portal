import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import MilestoneToggles from './MilestoneToggles'
import type { BookingTrackingEvent, ContainerTrackingRow } from '../tracking/trackingTypes'

type Props = {
  booking: BookingRecord
  trackingContainers?: ContainerTrackingRow[] | null
  trackingEvents?: BookingTrackingEvent[] | null
  onPatch: (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void
}

export default function BookingTaskPanel({
  booking,
  trackingContainers = [],
  trackingEvents = [],
  onPatch,
}: Props) {
  return (
    <aside className="card booking-task-panel">
      <MilestoneToggles
        booking={booking}
        containers={trackingContainers}
        events={trackingEvents}
        onPatch={onPatch}
      />
    </aside>
  )
}

import BookingDatesColumn from './form/BookingDatesColumn'
import BookingLeftColumn from './form/BookingLeftColumn'
import BookingMiddleColumn from './form/BookingMiddleColumn'
import BookingTaskPanel from './tasks/BookingTaskPanel'
import type { ContainerConflictResolution } from './containers/bookingContainerTypes'
import type { ContainerListItem } from './containers/useBookingContainers'
import type { BookingRecord, BookingRecordPatch, BookingShipment } from './bookingRecordTypes'
import { useBookingTasks } from './useBookingTasks'

import type { BookingTrackingEvent, ContainerTrackingRow } from './tracking/trackingTypes'
import type { PortConnectFieldKey } from './portConnect/portConnectProvenance'

type Props = {
  bookingId: string
  booking: BookingRecord
  shipment: BookingShipment | null
  containerRows: ContainerListItem[]
  trackingContainers?: ContainerTrackingRow[] | null
  trackingEvents?: BookingTrackingEvent[] | null
  onAddContainer: () => void
  onSaveContainer: (
    rowId: string,
    payload: { container_no: string; container_type: string | null; seal_no: string | null },
  ) => void
  onRemoveContainer: (rowId: string) => void
  onResolveContainer: (rowId: string, resolution: ContainerConflictResolution) => void
  onOverrideContainer: (rowId: string) => void
  onRevertContainer: (rowId: string) => void
  containerResolveBusy?: boolean
  lastSync?: string | null
  isFlashing?: (key: PortConnectFieldKey) => boolean
  onPatch: (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void
}

export default function BookingDetailsTab({
  bookingId,
  booking,
  shipment,
  containerRows,
  onAddContainer,
  onSaveContainer,
  onRemoveContainer,
  onResolveContainer,
  onOverrideContainer,
  onRevertContainer,
  containerResolveBusy,
  lastSync,
  isFlashing,
  trackingContainers = [],
  trackingEvents = [],
  onPatch,
}: Props) {
  const {
    tasks,
    staff,
    doneCount,
    toggleDone,
    addTask,
    removeTask,
    setDueDate,
  } = useBookingTasks(bookingId)

  return (
    <div className="booking-details-grid">
      <BookingLeftColumn booking={booking} staff={staff} onPatch={onPatch} />
      <BookingMiddleColumn
        booking={booking}
        shipment={shipment}
        trackingContainers={trackingContainers}
        containerRows={containerRows}
        onAddContainer={onAddContainer}
        onSaveContainer={onSaveContainer}
        onRemoveContainer={onRemoveContainer}
        onResolveContainer={onResolveContainer}
        onOverrideContainer={onOverrideContainer}
        onRevertContainer={onRevertContainer}
        containerResolveBusy={containerResolveBusy}
        lastSync={lastSync}
        isFlashing={isFlashing}
        onPatch={onPatch}
      />
      <BookingDatesColumn
        booking={booking}
        dischargePort={shipment?.destination ?? booking.m_discharge_port}
        trackingContainers={trackingContainers}
        lastSync={lastSync}
        isFlashing={isFlashing}
        onPatch={onPatch}
      />
      <BookingTaskPanel
        bookingId={bookingId}
        booking={booking}
        trackingContainers={trackingContainers}
        trackingEvents={trackingEvents}
        onPatch={onPatch}
        tasks={tasks}
        staff={staff}
        doneCount={doneCount}
        onToggle={toggleDone}
        onAdd={addTask}
        onDelete={removeTask}
        onDueDate={setDueDate}
      />
    </div>
  )
}

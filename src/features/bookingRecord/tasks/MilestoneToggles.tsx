import { Switch } from '@/components/ui/switch'
import PortStatusMilestones from './PortStatusMilestones'
import UbfClearanceMilestones, { useBookingCustoms } from './UbfClearanceMilestones'
import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import type {
  BookingTrackingEvent,
  ContainerTrackingRow,
} from '../tracking/trackingTypes'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type UbfMilestone = {
  key: keyof Pick<
    BookingRecord,
    'swb_released' | 'tlx_release_on_hand' | 'bacc_sent' | 'cleared' | 'truck_booked' | 'inv_approved' | 'inv_sent'
  >
  label: string
}

const UBF_MILESTONES: UbfMilestone[] = [
  { key: 'swb_released', label: 'SWB released' },
  { key: 'tlx_release_on_hand', label: 'TLX release on hand' },
  { key: 'bacc_sent', label: 'BACC sent' },
  { key: 'cleared', label: 'UBF cleared' },
  { key: 'truck_booked', label: 'Truck booked' },
  { key: 'inv_approved', label: 'Invoice passed for approval' },
  { key: 'inv_sent', label: 'Invoice sent to customer' },
]

type Props = {
  booking: BookingRecord
  containers?: ContainerTrackingRow[] | null
  events?: BookingTrackingEvent[] | null
  onPatch: PatchFn
}

export default function MilestoneToggles({
  booking,
  containers = [],
  events = [],
  onPatch,
}: Props) {
  // CF customs entry drives "UBF cleared". Manual switch only when UBF has no entry in CF.
  const customs = useBookingCustoms(booking.id)
  const hasEntry = Boolean(customs)
  return (
    <section className="booking-milestones">
      <h4 className="booking-panel-subtitle">Milestones</h4>
      <p className="booking-milestones__caption">
        Port releases sync from PortConnect. UBF Customs and MPI clearance sync from CyberFreight. Other UBF flags are manual.
      </p>

      <PortStatusMilestones containers={containers} events={events} />

      <div className="booking-milestones__group">
        <h5 className="booking-milestones__subheading">UBF status</h5>
        <ul className="booking-milestones__list">
          {UBF_MILESTONES.map(({ key, label }) => {
            if (key === 'cleared' && customs === undefined) return null
            if (key === 'cleared' && hasEntry && customs) {
              return (
                <UbfClearanceMilestones key={key} customs={customs} bookingId={booking.id} bookingRef={booking.booking_ref} />
              )
            }
            return (
              <li key={key} className="booking-milestones__row">
                <span>{key === 'cleared' ? 'UBF cleared (no CF entry)' : label}</span>
                <Switch
                  checked={Boolean(booking[key])}
                  onCheckedChange={(v) => onPatch({ [key]: v }, { [key]: v })}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

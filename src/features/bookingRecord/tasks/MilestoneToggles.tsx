import { Switch } from '@/components/ui/switch'
import PortStatusMilestones from './PortStatusMilestones'
import type { BookingRecord, BookingRecordPatch } from '../bookingRecordTypes'
import type {
  BookingTrackingEvent,
  ContainerTrackingRow,
} from '../tracking/trackingTypes'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type UbfMilestone = {
  key: keyof Pick<
    BookingRecord,
    'swb_released' | 'tlx_release_on_hand' | 'bacc_sent' | 'cleared' | 'truck_booked'
  >
  label: string
}

const UBF_MILESTONES: UbfMilestone[] = [
  { key: 'swb_released', label: 'SWB released' },
  { key: 'tlx_release_on_hand', label: 'TLX release on hand' },
  { key: 'bacc_sent', label: 'BACC sent' },
  { key: 'cleared', label: 'UBF cleared' },
  { key: 'truck_booked', label: 'Truck booked' },
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
  return (
    <section className="booking-milestones">
      <h4 className="booking-panel-subtitle">Milestones</h4>
      <p className="booking-milestones__caption">
        Port releases sync from PortConnect; UBF flags are manual workflow steps on the booking.
      </p>

      <PortStatusMilestones containers={containers} events={events} />

      <div className="booking-milestones__group">
        <h5 className="booking-milestones__subheading">UBF status (manual)</h5>
        <ul className="booking-milestones__list">
          {UBF_MILESTONES.map(({ key, label }) => (
            <li key={key} className="booking-milestones__row">
              <span>{label}</span>
              <Switch
                checked={Boolean(booking[key])}
                onCheckedChange={(v) => onPatch({ [key]: v }, { [key]: v })}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

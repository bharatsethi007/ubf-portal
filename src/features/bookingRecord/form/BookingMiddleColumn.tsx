import { Textarea } from '@/components/ui/textarea'
import BookingContainersField from '../containers/BookingContainersField'
import type { ContainerConflictResolution } from '../containers/bookingContainerTypes'
import type { ContainerListItem } from '../containers/useBookingContainers'
import type {
  BookingRecord,
  BookingRecordPatch,
  BookingShipment,
} from '../bookingRecordTypes'
import DualSourceField from './DualSourceField'
import FormCard from './FormCard'
import HoldReasonField from './HoldReasonField'

type PatchFn = (ui: Partial<BookingRecord>, db: BookingRecordPatch) => void

type Props = {
  booking: BookingRecord
  shipment: BookingShipment | null
  containerRows: ContainerListItem[]
  onAddContainer: () => void
  onSaveContainer: (
    rowId: string,
    payload: { container_no: string; container_type: string | null; seal_no: string | null },
  ) => void
  onRemoveContainer: (rowId: string) => void
  onResolveContainer: (rowId: string, resolution: ContainerConflictResolution) => void
  containerResolveBusy?: boolean
  onPatch: PatchFn
}

export default function BookingMiddleColumn({
  booking,
  shipment,
  containerRows,
  onAddContainer,
  onSaveContainer,
  onRemoveContainer,
  onResolveContainer,
  containerResolveBusy,
  onPatch,
}: Props) {
  return (
    <div className="booking-details-col">
      <FormCard title="Shipment">
        <DualSourceField
          label="ETA"
          erpValue={shipment?.eta ?? null}
          manualValue={booking.m_eta}
          onManualBlur={(v) => onPatch({ m_eta: v }, { m_eta: v })}
        />
        <DualSourceField
          label="ATF"
          erpValue={null}
          manualValue={booking.m_atf}
          onManualBlur={(v) => onPatch({ m_atf: v }, { m_atf: v })}
        />
        <DualSourceField
          label="Shipping line"
          erpValue={shipment?.vessel_flight ?? null}
          manualValue={booking.m_shipping_line}
          onManualBlur={(v) => onPatch({ m_shipping_line: v }, { m_shipping_line: v })}
        />
        <DualSourceField
          label="Discharge port"
          erpValue={shipment?.destination ?? null}
          manualValue={booking.m_discharge_port}
          onManualBlur={(v) => onPatch({ m_discharge_port: v }, { m_discharge_port: v })}
        />
        <BookingContainersField
          rows={containerRows}
          onAdd={onAddContainer}
          onSave={onSaveContainer}
          onRemove={onRemoveContainer}
          onResolve={(rowId, resolution) => onResolveContainer(rowId, resolution)}
          resolveBusy={containerResolveBusy}
        />
      </FormCard>

      <FormCard title="Hold">
        <HoldReasonField
          value={booking.hold_code}
          onChange={(code, label) =>
            onPatch({ hold_code: code, hold_label: label }, { hold_code: code })
          }
        />
        <label className="filter-field booking-form-field">
          <span className="filter-field__label">Hold notes</span>
          <Textarea
            className="booking-compact-textarea"
            rows={2}
            defaultValue={booking.hold_reason ?? ''}
            onBlur={(e) => {
              const next = e.target.value.trim() || null
              if (next !== (booking.hold_reason?.trim() || null)) {
                onPatch({ hold_reason: next }, { hold_reason: next })
              }
            }}
          />
        </label>
      </FormCard>
    </div>
  )
}
